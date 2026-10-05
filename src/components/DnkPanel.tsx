"use client";

import { useMemo, useState } from "react";

import {
  ВИДЫ_ПЕРЕХОДА,
  ЗНАЧКИ_ПЕРЕХОДА,
  КРУПНОСТИ,
  СЛОТЫ_СЦЕНЫ,
  type ВидПерехода,
  type ДНК,
  type КадрыСцены,
  type СлотСцены,
  type СценаДНК,
} from "@/lib/dnk/types";
import { файлДНК } from "@/lib/dnk/файл";
import {
  порядокКартинок,
  планМонтажа,
  текстСцены,
  type РежимКадров,
  type ЯзыкТекста,
} from "@/lib/dnk/seedance";

/*  ЭКРАН «ДНК РОЛИКА».

    Шаги 1–2 (нарезка и ДНК) работают. Шаги 3–6 требуют доступа к
    генерации, поэтому стоят серыми: кнопки видно, нажать нельзя.    */

type ШагиКонвейера = {
  n: string;
  имя: string;
  кто: "сам" | "вы";
  что: string;
};

const КОНВЕЙЕР: ШагиКонвейера[] = [
  { n: "1", имя: "Нарезка", кто: "сам", что: "сцены, кадры, время" },
  { n: "2", имя: "ДНК", кто: "сам", что: "гены и метки" },
  { n: "3", имя: "Ваши кадры", кто: "сам", что: "замена в кадрах" },
  { n: "4", имя: "Видео", кто: "сам", что: "оживление сцен" },
  { n: "5", имя: "Монтаж", кто: "сам", что: "склейка, переходы" },
  { n: "6", имя: "Проверка", кто: "вы", что: "ваш взгляд" },
];

/** Докуда конвейер доведён сейчас: дальше нужен доступ к генерации. */
const ГОТОВО_ДО = 2;

export type ПравкаГенов = {
  sceneId: string;
  поле: keyof СценаДНК["гены"] | "имя";
  значение: string;
};

type Свойства = {
  днк: ДНК | null;
  кадры: Map<string, КадрыСцены>;
  выбрана: string | null;
  занято: boolean;
  ход: { доля: number; подпись: string } | null;
  ошибка: string | null;
  времяПлеера: number;
  onВыбрать: (sceneId: string) => void;
  onПеремотать: (время: number) => void;
  onСдвинутьГраницу: (индекс: number, дельта: number) => void;
  onОбъединить: (индекс: number) => void;
  onРазрезать: (sceneId: string, время: number) => void;
  onПереход: (индекс: number, вид: ВидПерехода) => void;
  onСлот: (sceneId: string, слот: СлотСцены) => void;
  onГены: (правка: ПравкаГенов) => void;
  onСкачать: () => void;
  скачивается: boolean;
  onПересобрать: () => void;
  /*  Карточка «Для Seedance»: как владелец заводит сцену на сайте и
      на каком языке ему нужен текст.                               */
  режим: РежимКадров;
  язык: ЯзыкТекста;
  формат: string;
  onРежим: (р: РежимКадров) => void;
  onЯзык: (я: ЯзыкТекста) => void;
  onОтметить: (sceneId: string) => void;
  onСкачатьКадр: (sceneId: string, какой: "первый" | "последний") => void;
};

function секунды(v: number): string {
  return `${v.toFixed(1)} сек`;
}

function часы(v: number): string {
  const м = Math.floor(v / 60);
  const с = Math.floor(v % 60);
  return `${м}:${String(с).padStart(2, "0")}`;
}

export function DnkPanel(п: Свойства) {
  const {
    днк,
    кадры,
    выбрана,
    занято,
    ход,
    ошибка,
    времяПлеера,
    onВыбрать,
    onПеремотать,
    onСдвинутьГраницу,
    onОбъединить,
    onРазрезать,
    onПереход,
    onСлот,
    onГены,
    onСкачать,
    скачивается,
    onПересобрать,
    режим,
    язык,
    формат,
    onРежим,
    onЯзык,
    onОтметить,
    onСкачатьКадр,
  } = п;

  const [показатьФайл, setПоказатьФайл] = useState(false);
  /*  Короткая весть «Скопировано» — буфер молчит, и без неё непонятно,
      сработала кнопка или нет.                                      */
  const [весть, setВесть] = useState<string | null>(null);
  const сказать = (текст: string) => {
    setВесть(текст);
    window.setTimeout(() => setВесть(null), 1600);
  };
  /*  Буфер обмена доступен не везде (старый браузер, страница без
      https). Тогда подкладываем скрытое поле и копируем по-старому. */
  const скопировать = async (текст: string) => {
    try {
      await navigator.clipboard.writeText(текст);
      сказать("Скопировано");
      return;
    } catch {
      /* падаем в запасной способ ниже */
    }
    try {
      const поле = document.createElement("textarea");
      поле.value = текст;
      поле.style.position = "fixed";
      поле.style.opacity = "0";
      document.body.appendChild(поле);
      поле.select();
      const вышло = document.execCommand("copy");
      document.body.removeChild(поле);
      сказать(вышло ? "Скопировано" : "Выделите текст и скопируйте вручную");
    } catch {
      сказать("Выделите текст и скопируйте вручную");
    }
  };

  const индекс = useMemo(() => {
    if (!днк) return -1;
    return днк.сцены.findIndex((с) => с.id === выбрана);
  }, [днк, выбрана]);
  const сцена = индекс >= 0 && днк ? днк.сцены[индекс] : null;

  if (занято || (!днк && !ошибка)) {
    return (
      <div className="panel flex flex-col items-start gap-3 p-6">
        <p className="font-display text-[15px] font-bold uppercase tracking-[0.1em] text-chalk">
          Режем ролик на сцены
        </p>
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ember transition-[width] duration-200"
            style={{ width: `${Math.round((ход?.доля ?? 0) * 100)}%` }}
          />
        </div>
        <p className="font-mono text-[11px] text-dim">{ход?.подпись ?? "готовим…"}</p>
        <p className="max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
          Частая выборка — десять кадров в секунду, иначе склейка проскакивает между
          замерами. Потом каждый стык уточняется до кадра.
        </p>
      </div>
    );
  }

  if (ошибка) {
    return (
      <div className="panel flex flex-col items-start gap-3 p-5">
        <p className="font-display text-[14px] font-bold text-chalk">ДНК не собралась</p>
        <p className="text-[12.5px] leading-relaxed text-muted">{ошибка}</p>
        <button type="button" className="btn btn-ghost" onClick={onПересобрать}>
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!днк) return null;

  const всего = днк.длительность || 1;

  return (
    <div className="min-w-0 space-y-3">
      <div className="rounded-xl bg-chalk px-4 py-2.5 text-[13px] leading-snug text-[#0b0b10]">
        <b>ДНК ролика.</b> Ролик разобран на сцены: границы, переходы, первый и последний
        кадр каждой сцены. Сейчас работают шаги 1–2. Шаги 3–6 — генерация, они включатся,
        когда появится доступ к модели.
      </div>

      {/* ---------- конвейер ---------- */}
      <div className="grid grid-cols-3 gap-1.5 md:grid-cols-6">
        {КОНВЕЙЕР.map((шаг, i) => {
          const номер = i + 1;
          const сделано = номер <= ГОТОВО_ДО;
          const скоро = номер > ГОТОВО_ДО;
          return (
            <div
              key={шаг.n}
              className={`grid gap-0.5 rounded-xl border bg-raised px-2.5 py-2 text-[12px] ${
                сделано ? "border-good/40" : "border-line opacity-55"
              }`}
              title={скоро ? "Скоро: нужен доступ к генерации" : undefined}
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-[0.07em] ${
                  шаг.кто === "сам" ? "text-ice" : "text-flare"
                }`}
              >
                {шаг.кто}
              </span>
              <b
                className={`font-display text-[13px] ${сделано ? "text-good" : "text-chalk"}`}
              >
                {сделано ? "✓ " : ""}
                {номер}. {шаг.имя}
              </b>
              <span className="truncate text-muted">{скоро ? "скоро" : шаг.что}</span>
            </div>
          );
        })}
      </div>

      {/* ---------- нить ДНК ---------- */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="hud-label">Нить ДНК — сцены и переходы</p>
          <p className="font-mono text-[11px] text-dim">
            {днк.сцены.length} сцен · {днк.переходы.length} переходов ·{" "}
            {секунды(днк.длительность)}
          </p>
        </div>

        <div className="mt-2.5 flex min-h-[72px] items-stretch overflow-x-auto">
          {днк.сцены.map((с, i) => (
            <div key={с.id} className="flex items-stretch" style={{ flex: с.конец - с.начало }}>
              <button
                type="button"
                onClick={() => {
                  onВыбрать(с.id);
                  onПеремотать(с.начало + 0.02);
                }}
                aria-pressed={с.id === выбрана}
                className={`relative flex min-w-[64px] flex-1 flex-col justify-between overflow-hidden rounded-xl border bg-raised px-2.5 py-2 text-left transition ${
                  с.id === выбрана
                    ? "border-ember shadow-[0_0_0_1px_var(--color-ember),0_0_24px_-6px_var(--color-ember)]"
                    : "border-edge hover:border-muted"
                }`}
              >
                <b className="font-display text-[13px] text-chalk">
                  {i + 1}. {с.имя.replace(/^Сцена \d+$/, "")}
                  {с.сгенерирована ? <span className="ml-1 text-good">✓</span> : null}
                </b>
                <small className="truncate text-[11.5px] text-muted">
                  {с.слоты.length ? с.слоты.map((х) => `[${х}]`).join(" ") : секунды(с.конец - с.начало)}
                </small>
                <span
                  className="absolute inset-x-0 bottom-0 h-[3px]"
                  style={{ background: с.цвет }}
                />
              </button>
              {i < днк.переходы.length ? (
                <div
                  className="grid w-[26px] flex-none place-items-center"
                  title={`${днк.переходы[i].вид}${днк.переходы[i].проверьте ? " — проверьте" : ""}`}
                >
                  <span className="whitespace-nowrap text-[10.5px] tracking-[0.04em] text-flare [writing-mode:vertical-rl] [transform:rotate(180deg)]">
                    {днк.переходы[i].вид}
                    {днк.переходы[i].проверьте ? " ?" : ""}
                  </span>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-1 flex justify-between font-mono text-[11px] text-dim">
          <span>0:00</span>
          <span>{часы(всего / 4)}</span>
          <span>{часы(всего / 2)}</span>
          <span>{часы((всего * 3) / 4)}</span>
          <span>{часы(всего)}</span>
        </div>
      </div>

      {/* ---------- сцена + подстановка ---------- */}
      {/*  Карточке «Для Seedance» нужно больше места, чем карточке
           сцены: в ней список картинок и готовый текст.          */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div className="panel p-4">
          {сцена ? (
            <КарточкаСцены
              сцена={сцена}
              индекс={индекс}
              всегоСцен={днк.сцены.length}
              кадры={кадры.get(сцена.id) ?? null}
              переходПосле={днк.переходы[индекс] ?? null}
              времяПлеера={времяПлеера}
              onПеремотать={onПеремотать}
              onСдвинутьГраницу={onСдвинутьГраницу}
              onОбъединить={onОбъединить}
              onРазрезать={onРазрезать}
              onПереход={onПереход}
              onСлот={onСлот}
              onГены={onГены}
            />
          ) : (
            <p className="text-[13px] text-muted">Выберите сцену в нити ДНК.</p>
          )}
        </div>

        <div className="grid content-start gap-3">
          {сцена ? (
            <КарточкаSeedance
              сцена={сцена}
              номер={индекс + 1}
              кадры={кадры.get(сцена.id) ?? null}
              режим={режим}
              язык={язык}
              формат={формат}
              onРежим={onРежим}
              onЯзык={onЯзык}
              onОтметить={() => onОтметить(сцена.id)}
              onСкачатьКадр={(какой) => onСкачатьКадр(сцена.id, какой)}
              onКопировать={скопировать}
            />
          ) : null}

          <div className="panel grid content-start gap-3 p-4 opacity-70">
          <h2 className="font-display text-[17px] font-bold text-chalk">Что подставляем</h2>
          <p className="text-[12.5px] leading-relaxed text-muted">
            Здесь выбирают свет, героя, место и товар — и каждая сцена рисуется заново с
            ними. Шаг включится вместе с генерацией.
          </p>
          {["Свет и цвет", "[герой]", "[место]", "[товар]"].map((имя) => (
            <div key={имя}>
              <p className="hud-label">{имя}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {["Как в оригинале", "Ваше фото"].map((в) => (
                  <span
                    key={в}
                    className="cursor-not-allowed rounded-full border border-edge bg-raised px-3 py-1.5 text-[13px] text-dim"
                  >
                    {в}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <p className="rounded-xl border border-dashed border-edge px-3 py-2.5 text-[12.5px] text-muted">
            <b className="text-ice">🔒 Не меняется:</b> сюжет, композиция, камера, ритм,
            переходы. Их держат первый и последний кадр каждой сцены.
          </p>
          </div>
        </div>
      </div>

      {/* ---------- монтаж ---------- */}
      <div className="panel p-4">
        <h2 className="font-display text-[17px] font-bold text-chalk">Монтаж</h2>
        <p className="hud-label mt-1.5">Дорожка: сцены и переходы из оригинала</p>

        <div className="mt-2.5 flex h-[66px] items-stretch overflow-x-auto">
          {днк.сцены.map((с, i) => (
            <div key={с.id} className="flex items-stretch" style={{ flex: с.конец - с.начало }}>
              <button
                type="button"
                onClick={() => onВыбрать(с.id)}
                className={`flex min-w-[36px] flex-1 items-end overflow-hidden rounded-lg border px-1.5 py-1 text-[11px] font-semibold text-chalk ${
                  с.id === выбрана ? "outline outline-2 outline-white" : ""
                }`}
                style={{ borderColor: с.цвет, background: `${с.цвет}22` }}
              >
                {i + 1}
              </button>
              {i < днк.переходы.length ? (
                <span
                  className="grid w-[22px] flex-none place-items-center text-[15px] text-flare"
                  title={днк.переходы[i].вид}
                >
                  {ЗНАЧКИ_ПЕРЕХОДА[днк.переходы[i].вид]}
                </span>
              ) : null}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between font-mono text-[11px] text-dim">
          <span>0:00</span>
          <span>{секунды(всего)}</span>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onСкачать}
            disabled={скачивается}
          >
            {скачивается ? "Собираем архив…" : "Скачать ДНК"}
          </button>
          <span className="text-[12.5px] text-muted">
            zip: dnk.json и по три кадра на сцену · {днк.сцены.length * 3} кадров
          </span>
          <button
            type="button"
            className="btn btn-ghost ml-auto"
            onClick={onПересобрать}
            title="Найти склейки заново — после ручных правок вернётся исходная нарезка"
          >
            Нарезать заново
          </button>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {КОНВЕЙЕР.slice(ГОТОВО_ДО).map((шаг, i) => (
            <button
              key={шаг.n}
              type="button"
              disabled
              className="btn btn-ghost cursor-not-allowed justify-start text-left opacity-45"
              title="Скоро: нужен доступ к генерации"
            >
              {ГОТОВО_ДО + i + 1}. {шаг.имя} — скоро
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setПоказатьФайл((v) => !v)}
          className="mt-3 text-[13px] text-muted underline-offset-2 hover:text-chalk hover:underline"
        >
          {показатьФайл ? "Свернуть файл ДНК" : "Файл ДНК (что уходит в генерацию)"}
        </button>
        {показатьФайл ? (
          <pre className="mt-2 max-h-[280px] overflow-auto rounded-xl border border-line bg-[#0a0a0f] p-3 font-mono text-[11.5px] leading-relaxed text-[#d8d5e6]">
            {JSON.stringify(файлДНК(днк), null, 2)}
          </pre>
        ) : null}
      </div>

      {/* ---------- план монтажа ---------- */}
      <ПланМонтажа днк={днк} выбрана={выбрана} onВыбрать={onВыбрать} onКопировать={скопировать} />

      {весть ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-good px-4 py-2 text-[13.5px] font-bold text-[#04140b] shadow-lg">
          {весть}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/*  ПЛАН МОНТАЖА. Сцены сверху вниз с переходами между ними: по нему
    ролик склеивают в любом редакторе.                               */
function ПланМонтажа({
  днк,
  выбрана,
  onВыбрать,
  onКопировать,
}: {
  днк: ДНК;
  выбрана: string | null;
  onВыбрать: (id: string) => void;
  onКопировать: (текст: string) => void;
}) {
  const всего = днк.сцены.reduce((a, с) => a + (с.конец - с.начало), 0);
  const готовых = днк.сцены.filter((с) => с.сгенерирована).length;

  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold text-chalk">План монтажа</h2>
        <span className="rounded-full bg-ice/12 px-2.5 py-1 font-mono text-[12px] text-ice">
          {готовых} из {днк.сцены.length} сцен готово · {всего.toFixed(1)} с
        </span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
        Склейте готовые сцены сверху вниз с этими переходами и длительностями — в CapCut
        или любом другом редакторе.
      </p>

      <div className="mt-3 grid gap-1.5">
        {днк.сцены.map((с, i) => {
          const переход = днк.переходы[i];
          return (
            <div key={с.id} className="grid gap-1.5">
              <button
                type="button"
                onClick={() => onВыбрать(с.id)}
                className={`grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border bg-raised px-2.5 py-2 text-left text-[13.5px] ${
                  с.id === выбрана ? "border-ember" : "border-line"
                }`}
              >
                <span className="font-display text-muted">{i + 1}</span>
                <span className="min-w-0 truncate text-chalk">
                  {с.имя} <span className="text-dim">· s{i + 1}.mp4</span>{" "}
                  {с.сгенерирована ? <span className="text-good">✓</span> : null}
                </span>
                <span className="font-mono text-muted">{(с.конец - с.начало).toFixed(1)} с</span>
              </button>
              {переход ? (
                <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[13px] text-flare">
                  <span>↓</span>
                  <span>
                    {переход.вид}
                    {переход.длительность > 0
                      ? ` · ${переход.длительность.toFixed(1).replace(".", ",")} с`
                      : ""}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onКопировать(планМонтажа(днк))}
        >
          Копировать план
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function КарточкаСцены({
  сцена,
  индекс,
  всегоСцен,
  кадры,
  переходПосле,
  времяПлеера,
  onПеремотать,
  onСдвинутьГраницу,
  onОбъединить,
  onРазрезать,
  onПереход,
  onСлот,
  onГены,
}: {
  сцена: СценаДНК;
  индекс: number;
  всегоСцен: number;
  кадры: КадрыСцены | null;
  переходПосле: { вид: ВидПерехода; проверьте: boolean } | null;
  времяПлеера: number;
  onПеремотать: (время: number) => void;
  onСдвинутьГраницу: (индекс: number, дельта: number) => void;
  onОбъединить: (индекс: number) => void;
  onРазрезать: (sceneId: string, время: number) => void;
  onПереход: (индекс: number, вид: ВидПерехода) => void;
  onСлот: (sceneId: string, слот: СлотСцены) => void;
  onГены: (правка: ПравкаГенов) => void;
}) {
  const длина = сцена.конец - сцена.начало;
  const можноРазрезать =
    времяПлеера > сцена.начало + 0.3 && времяПлеера < сцена.конец - 0.3;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold text-chalk">
          Сцена {индекс + 1}
        </h2>
        <span className="font-mono text-[12.5px] text-muted">
          {сцена.начало.toFixed(2)}–{сцена.конец.toFixed(2)} сек · {длина.toFixed(2)} сек
        </span>
      </div>

      <input
        value={сцена.имя}
        onChange={(e) => onГены({ sceneId: сцена.id, поле: "имя", значение: e.target.value })}
        placeholder={`Сцена ${индекс + 1}`}
        className="w-full rounded-lg border border-line bg-void px-2.5 py-1.5 font-display text-[14px] text-chalk outline-none focus:border-ember"
      />

      {/* метки слотов */}
      <div className="flex flex-wrap items-center gap-1.5">
        {СЛОТЫ_СЦЕНЫ.map((слот) => {
          const есть = сцена.слоты.includes(слот);
          return (
            <button
              key={слот}
              type="button"
              onClick={() => onСлот(сцена.id, слот)}
              aria-pressed={есть}
              className={`rounded-md border px-2.5 py-1 font-mono text-[12.5px] transition ${
                есть
                  ? "border-ember/40 bg-ember/15 text-ember"
                  : "border-line text-dim line-through"
              }`}
            >
              [{слот}]
            </button>
          );
        })}
        <span className="text-[12px] text-dim">
          — к этой сцене прикладываются фото клиента
        </span>
      </div>

      {/* кадры */}
      <div>
        <p className="hud-label">Оригинал: начало · конец</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {(
            [
              ["начало", кадры?.первый ?? null],
              ["середина", кадры?.средний ?? null],
              ["конец", кадры?.последний ?? null],
            ] as const
          ).map(([подпись, кадр]) => (
            <button
              key={подпись}
              type="button"
              onClick={() => кадр && onПеремотать(кадр.время)}
              className="relative overflow-hidden rounded-xl border border-edge bg-raised"
              style={{ aspectRatio: "9 / 14" }}
            >
              {кадр ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={кадр.url}
                  alt={`${подпись} сцены ${индекс + 1}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full place-items-center text-[11.5px] text-dim">
                  кадр снимается
                </span>
              )}
              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] text-chalk">
                {подпись}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* гены */}
      <div>
        <p className="hud-label">Гены сцены</p>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          <Ген замок знак="🔒" имя="Длительность" значение={`${длина.toFixed(2)} сек`} />
          <Ген
            замок
            знак="🔒"
            имя="Переход на выходе"
            значение={переходПосле ? переходПосле.вид : "конец ролика"}
          />
          <ГенПоле
            замок
            имя="Что происходит"
            значение={сцена.гены.действие}
            подсказка="например: рука ставит сумку на мраморный стол"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "действие", значение: v })}
          />
          <ГенПоле
            замок
            имя="То же по-английски"
            значение={сцена.гены.действиеEn}
            подсказка="можно не заполнять — пойдёт русская фраза"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "действиеEn", значение: v })}
          />
          <ГенСписок
            имя="План"
            значение={сцена.гены.план}
            варианты={КРУПНОСТИ}
            пусто="не определено"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "план", значение: v })}
          />
          <ГенПоле
            замок
            имя="Камера"
            значение={сцена.гены.камера}
            подсказка="движение камеры"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "камера", значение: v })}
          />
          <ГенПоле
            имя="Свет и цвет"
            значение={сцена.гены.свет}
            подсказка="измерено по кадрам"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "свет", значение: v })}
          />
          {сцена.слоты.includes("герой") ? (
            <ГенПоле
              имя="Герой"
              значение={сцена.гены.герой}
              подсказка="кто в кадре"
              onChange={(v) => onГены({ sceneId: сцена.id, поле: "герой", значение: v })}
            />
          ) : null}
          {сцена.слоты.includes("место") ? (
            <ГенПоле
              имя="Место"
              значение={сцена.гены.место}
              подсказка="где снято"
              onChange={(v) => onГены({ sceneId: сцена.id, поле: "место", значение: v })}
            />
          ) : null}
          {сцена.слоты.includes("товар") ? (
            <ГенПоле
              имя="Товар"
              значение={сцена.гены.товар}
              подсказка="что рекламируется"
              onChange={(v) => onГены({ sceneId: сцена.id, поле: "товар", значение: v })}
            />
          ) : null}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            className="btn btn-ghost cursor-not-allowed opacity-45"
            title="Нужен доступ к модели"
          >
            Заполнить нейросетью
          </button>
          <span className="text-[12px] text-dim">нужен доступ к модели</span>
        </div>
      </div>

      {/* правка границ */}
      <div className="rounded-xl border border-line bg-raised p-3">
        <p className="hud-label">Поправить руками</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-muted">Начало сцены:</span>
          {[-0.2, -0.04, 0.04, 0.2].map((д) => (
            <button
              key={д}
              type="button"
              className="btn btn-ghost px-2.5 py-1 text-[12px]"
              disabled={индекс === 0}
              onClick={() => onСдвинутьГраницу(индекс, д)}
              title={индекс === 0 ? "У первой сцены начало не сдвинуть" : undefined}
            >
              {д > 0 ? `+${д}` : д} с
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] text-muted">Конец сцены:</span>
          {[-0.2, -0.04, 0.04, 0.2].map((д) => (
            <button
              key={д}
              type="button"
              className="btn btn-ghost px-2.5 py-1 text-[12px]"
              disabled={индекс >= всегоСцен - 1}
              onClick={() => onСдвинутьГраницу(индекс + 1, д)}
              title={индекс >= всегоСцен - 1 ? "У последней сцены конец не сдвинуть" : undefined}
            >
              {д > 0 ? `+${д}` : д} с
            </button>
          ))}
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={индекс === 0}
            onClick={() => onОбъединить(индекс)}
          >
            Объединить с предыдущей
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={индекс >= всегоСцен - 1}
            onClick={() => onОбъединить(индекс + 1)}
          >
            Объединить со следующей
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!можноРазрезать}
            onClick={() => onРазрезать(сцена.id, времяПлеера)}
            title={
              можноРазрезать
                ? `Разрезать на ${времяПлеера.toFixed(2)} сек`
                : "Поставьте плеер внутрь сцены, не ближе 0,3 сек к границе"
            }
          >
            Разрезать здесь ({времяПлеера.toFixed(2)} с)
          </button>
        </div>

        {переходПосле ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] text-muted">Переход на выходе:</span>
            <select
              value={переходПосле.вид}
              onChange={(e) => onПереход(индекс, e.target.value as ВидПерехода)}
              className="rounded-lg border border-line bg-void px-2.5 py-1.5 text-[13px] text-chalk outline-none focus:border-ember"
            >
              {ВИДЫ_ПЕРЕХОДА.map((в) => (
                <option key={в} value={в}>
                  {ЗНАЧКИ_ПЕРЕХОДА[в]} {в}
                </option>
              ))}
            </select>
            {переходПосле.проверьте ? (
              <span className="text-[12px] text-flare">
                признаки сошлись слабо — проверьте
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Ген({
  замок,
  знак,
  имя,
  значение,
}: {
  замок?: boolean;
  знак: string;
  имя: string;
  значение: string;
}) {
  return (
    <div
      className={`grid grid-cols-[22px_minmax(0,1fr)] gap-2 rounded-lg border bg-raised px-2.5 py-1.5 text-[13px] ${
        замок ? "border-line" : "border-ember/30"
      }`}
    >
      <span className={замок ? "text-ice" : "text-ember"}>{знак}</span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
          {имя}
        </div>
        <div className="truncate text-chalk">{значение || "—"}</div>
      </div>
    </div>
  );
}

/*  Ген, у которого значений конечный набор: его выбирают, а не
    печатают. Автоопределение остаётся — просто его можно сменить. */
function ГенСписок({
  имя,
  значение,
  варианты,
  пусто,
  onChange,
}: {
  имя: string;
  значение: string;
  варианты: readonly string[];
  пусто: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[13px]">
      <span className="text-ice">🔒</span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
          {имя}
        </div>
        <select
          value={значение}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-chalk outline-none"
        >
          <option value="">{пусто}</option>
          {варианты.map((в) => (
            <option key={в} value={в}>
              {в}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function ГенПоле({
  замок,
  имя,
  значение,
  подсказка,
  onChange,
}: {
  замок?: boolean;
  имя: string;
  значение: string;
  подсказка: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      className={`grid grid-cols-[22px_minmax(0,1fr)] gap-2 rounded-lg border bg-raised px-2.5 py-1.5 text-[13px] ${
        замок ? "border-line" : "border-ember/30"
      }`}
    >
      <span className={замок ? "text-ice" : "text-ember"}>{замок ? "🔒" : "✎"}</span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.05em] text-muted">
          {имя}
        </div>
        <input
          value={значение}
          placeholder={подсказка}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-chalk outline-none placeholder:text-dim"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/*  КАРТОЧКА «ДЛЯ SEEDANCE».

    Владелец генерирует сцены руками на сайте Seedance. Здесь — ровно
    то, что ему нужно перед глазами: в каком порядке загрузить
    картинки, какой текст вставить и какую длительность выставить.
    Номера картинок в тексте те же, что в списке: и список, и текст
    строит один и тот же код.                                        */
function КарточкаSeedance({
  сцена,
  номер,
  кадры,
  режим,
  язык,
  формат,
  onРежим,
  onЯзык,
  onОтметить,
  onСкачатьКадр,
  onКопировать,
}: {
  сцена: СценаДНК;
  номер: number;
  кадры: КадрыСцены | null;
  режим: РежимКадров;
  язык: ЯзыкТекста;
  формат: string;
  onРежим: (р: РежимКадров) => void;
  onЯзык: (я: ЯзыкТекста) => void;
  onОтметить: () => void;
  onСкачатьКадр: (какой: "первый" | "последний") => void;
  onКопировать: (текст: string) => void;
}) {
  const длина = (сцена.конец - сцена.начало).toFixed(1);
  const картинки = порядокКартинок(сцена, режим, номер);
  const текст = текстСцены(сцена, { режим, язык, номер });
  const естьПодмена = сцена.слоты.includes("товар") || сцена.слоты.includes("герой");

  const превью = (вид: string): string | null => {
    if (вид === "первый") return кадры?.первый?.url ?? null;
    if (вид === "последний") return кадры?.последний?.url ?? null;
    return null;
  };

  return (
    <div className="panel grid gap-3.5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-[17px] font-bold text-chalk">Для Seedance</h2>
        <span className="rounded-full bg-ice/12 px-2.5 py-1 font-mono text-[12px] text-ice">
          длительность {длина} с · {формат}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-0.5 rounded-xl border border-line bg-[#0a0a0f] p-0.5">
          {(
            [
              ["кадры", "Первый + последний кадр"],
              ["образцы", "По образцам"],
            ] as const
          ).map(([ключ, имя]) => (
            <button
              key={ключ}
              type="button"
              aria-pressed={режим === ключ}
              onClick={() => onРежим(ключ)}
              className={`rounded-lg px-2.5 py-1.5 text-[13px] ${
                режим === ключ ? "bg-raised text-chalk" : "text-muted hover:text-chalk"
              }`}
            >
              {имя}
            </button>
          ))}
        </div>
        <div className="inline-flex gap-0.5 rounded-xl border border-line bg-[#0a0a0f] p-0.5">
          {(["en", "ru"] as const).map((ключ) => (
            <button
              key={ключ}
              type="button"
              aria-pressed={язык === ключ}
              onClick={() => onЯзык(ключ)}
              className={`rounded-lg px-3 py-1.5 text-[13px] uppercase ${
                язык === ключ ? "bg-raised text-chalk" : "text-muted hover:text-chalk"
              }`}
            >
              {ключ}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="hud-label">1 · Загрузите картинки в этом порядке</p>
        <div className="mt-1.5 grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(120px,1fr))]">
          {картинки.map((к, j) => (
            <div
              key={к.вид}
              className="grid gap-1.5 rounded-xl border border-line bg-raised p-2 text-[12.5px]"
            >
              <span className="font-display text-[13px] text-chalk">
                {j + 1}. {к.имя}
              </span>
              <div
                className="relative overflow-hidden rounded-lg border border-edge bg-void"
                style={{ aspectRatio: "9 / 12" }}
              >
                {превью(к.вид) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={превью(к.вид)!} alt={к.имя} className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center px-2 text-center text-[11px] text-dim">
                    ваше фото
                  </span>
                )}
                <span className="absolute left-1.5 top-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] text-chalk">
                  картинка {j + 1}
                </span>
              </div>
              <span className="truncate text-dim" title={к.файл}>
                {к.файл}
              </span>
              {к.скачиваемый ? (
                <button
                  type="button"
                  className="btn btn-ghost px-2.5 py-1 text-[12px]"
                  onClick={() => onСкачатьКадр(к.вид === "первый" ? "первый" : "последний")}
                >
                  Скачать
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {режим === "кадры" && естьПодмена ? (
        <p className="rounded-xl border border-dashed border-flare/45 px-3 py-2.5 text-[13px] text-[#f3dca6]">
          Если ваш Seedance в режиме «первый + последний кадр» не даёт добавить фото
          товара или героя — сначала замените их <b>в самих кадрах</b> (в любой нейросети
          для картинок), потом грузите только два кадра. Так композиция удержится точнее.
        </p>
      ) : null}

      <div>
        <p className="hud-label">2 · Текст сцены</p>
        <pre className="mt-1.5 whitespace-pre-wrap break-words rounded-xl border border-edge bg-[#0a0a0f] p-3.5 font-mono text-[13px] leading-relaxed text-[#e6e3f0]">
          {текст}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={() => onКопировать(текст)}>
          Копировать текст
        </button>
        <button
          type="button"
          className={`btn btn-ghost ${сцена.сгенерирована ? "text-good" : ""}`}
          onClick={onОтметить}
        >
          {сцена.сгенерирована ? "✓ Сцена сгенерирована" : "Отметить: сгенерировал"}
        </button>
        <span className="text-[13px] text-muted">
          3 · Длительность в Seedance: <b className="text-chalk">{длина} с</b> (или
          ближайшая, потом обрежете)
        </span>
      </div>
    </div>
  );
}
