"use client";

import { useMemo, useState } from "react";

import {
  ВИДЫ_ПЕРЕХОДА,
  ЗНАЧКИ_ПЕРЕХОДА,
  СЛОТЫ_СЦЕНЫ,
  type ВидПерехода,
  type ДНК,
  type КадрыСцены,
  type СлотСцены,
  type СценаДНК,
} from "@/lib/dnk/types";
import { файлДНК } from "@/lib/dnk/файл";

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
  } = п;

  const [показатьФайл, setПоказатьФайл] = useState(false);

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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
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
            имя="Действие"
            значение={сцена.гены.действие}
            подсказка="что происходит в кадре"
            onChange={(v) => onГены({ sceneId: сцена.id, поле: "действие", значение: v })}
          />
          <ГенПоле
            замок
            имя="План"
            значение={сцена.гены.план}
            подсказка="крупный / средний / общий"
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
