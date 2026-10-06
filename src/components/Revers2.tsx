"use client";

import { useCallback, useRef, useState } from "react";

import type { Проверка, РазборОсновы } from "@/lib/osnova/основа";

/*  РЕВЕРС 2 — ГЛАВНЫЙ ПУТЬ.

    Ролик → фишка → Claude пишет шаблон → генерация → витрина. Всё
    прежнее (промпт, ДНК, раскадровка, «Для Seedance») никуда не делось
    — оно в свёрнутом блоке внизу.

    Здесь блок 1: чистая видео-основа. Остальные блоки добавляются
    следующими разделами задания.                                     */

type Свойства = {
  /*  Файл отдаётся и наверх, в прежний разбор: один ролик на оба
      пути, выбирать его дважды человеку незачем.                   */
  onФайл: (файл: File) => void;
  onСообщение: (вид: "success" | "error" | "info", заголовок: string, текст?: string) => void;
};

type Состояние = "пусто" | "идёт" | "готово" | "беда";

export function Revers2({ onФайл, onСообщение }: Свойства) {
  const [состояние, setСостояние] = useState<Состояние>("пусто");
  const [разбор, setРазбор] = useState<РазборОсновы | null>(null);
  const [проверки, setПроверки] = useState<Проверка[]>([]);
  const [беда, setБеда] = useState<string | null>(null);
  const [правкаРамки, setПравкаРамки] = useState(false);
  const [рамка, setРамка] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const полеФайла = useRef<HTMLInputElement | null>(null);

  const принятьФайл = useCallback(
    async (файл: File) => {
      onФайл(файл);
      setСостояние("идёт");
      setБеда(null);
      setРазбор(null);
      try {
        const форма = new FormData();
        форма.append("файл", файл);
        const ответ = await fetch("/api/osnova", { method: "POST", body: форма });
        const данные = (await ответ.json()) as {
          разбор?: РазборОсновы;
          проверки?: Проверка[];
          error?: string;
        };
        if (!ответ.ok || !данные.разбор) throw new Error(данные.error ?? `Сервер ответил ${ответ.status}`);
        setРазбор(данные.разбор);
        setПроверки(данные.проверки ?? []);
        setРамка(данные.разбор.рамка);
        setСостояние("готово");
        onСообщение(
          "success",
          "Видео-основа готова",
          `${данные.разбор.большая.ширина}×${данные.разбор.большая.высота} и запасная ${данные.разбор.запасная.ширина}×${данные.разбор.запасная.высота}`,
        );
      } catch (е) {
        const текст = е instanceof Error ? е.message : "Неизвестная ошибка";
        setБеда(текст);
        setСостояние("беда");
        onСообщение("error", "Основа не собралась", текст);
      }
    },
    [onФайл, onСообщение],
  );

  const пересобрать = useCallback(async () => {
    if (!разбор || !рамка) return;
    setСостояние("идёт");
    try {
      const ответ = await fetch("/api/osnova", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: разбор.id, рамка }),
      });
      const данные = (await ответ.json()) as {
        разбор?: РазборОсновы;
        проверки?: Проверка[];
        error?: string;
      };
      if (!ответ.ok || !данные.разбор) throw new Error(данные.error ?? `Сервер ответил ${ответ.status}`);
      setРазбор(данные.разбор);
      setПроверки(данные.проверки ?? []);
      setРамка(данные.разбор.рамка);
      setСостояние("готово");
      onСообщение("success", "Основа пересобрана по вашей рамке");
    } catch (е) {
      const текст = е instanceof Error ? е.message : "Неизвестная ошибка";
      setБеда(текст);
      setСостояние("беда");
      onСообщение("error", "Не удалось пересобрать", текст);
    }
  }, [разбор, рамка, onСообщение]);

  const ссылка = (файл: string) =>
    разбор ? `/api/osnova/${разбор.id}/${encodeURIComponent(файл)}` : "#";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-chalk px-4 py-2.5 text-[13px] leading-snug text-[#0b0b10]">
        <b>Поверх оригинала.</b> Трендовый ролик уходит в Seedance видео-основой и задаёт всё
        движение, камеру и тайминг. Меняются только лицо, тело, одежда, место и товар. Всё
        прежнее — промпт, ДНК, раскадровка — внизу, в свёрнутых блоках.
      </div>

      <section className="panel p-4">
        <p className="hud-label">1 · Видео-основа</p>

        {состояние === "пусто" || состояние === "беда" ? (
          <div className="mt-3 grid place-items-center gap-3 rounded-xl border border-dashed border-edge px-4 py-8 text-center">
            <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted">
              Перетащите ролик-тренд или выберите файл. Лучше исходный файл, а не запись
              экрана: у записи мельче картинка и по краям интерфейс.
            </p>
            <input
              ref={полеФайла}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const файл = e.target.files?.[0];
                if (файл) void принятьФайл(файл);
                e.target.value = "";
              }}
            />
            <button type="button" className="btn btn-primary" onClick={() => полеФайла.current?.click()}>
              Выбрать ролик
            </button>
            {беда ? <p className="text-[12.5px] text-bad">{беда}</p> : null}
          </div>
        ) : null}

        {состояние === "идёт" ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-line bg-raised px-4 py-5">
            <p className="font-display text-[14px] font-bold text-chalk">Готовим основу</p>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="animate-sweep absolute inset-0" />
            </div>
            <p className="text-[12.5px] text-muted">
              Ищем неподвижные полосы интерфейса, чистим шум и пересобираем в 1080×1920 и
              720×1280. Это занимает несколько секунд.
            </p>
          </div>
        ) : null}

        {разбор && состояние !== "идёт" ? (
          <div className="mt-3 grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <video
              src={ссылка(разбор.запасная.файл)}
              className="w-full rounded-xl border border-edge bg-void"
              style={{ aspectRatio: `${разбор.большая.ширина} / ${разбор.большая.высота}` }}
              controls
              muted
              playsInline
            />

            <div className="grid content-start gap-3">
              <div>
                <b className="text-[14px] text-chalk">{разбор.имя}</b>{" "}
                <span className="font-mono text-[12px] text-dim">
                  · исходник {разбор.исходник.ширина}×{разбор.исходник.высота} ·{" "}
                  {разбор.исходник.длительность.toFixed(1)} сек
                </span>
              </div>

              <div className="grid gap-1.5">
                {проверки.map((п) => (
                  <div key={п.текст} className="flex gap-2 text-[13px] leading-snug">
                    <span className={п.вид === "ok" ? "text-good" : "text-warn"}>
                      {п.вид === "ok" ? "✓" : "!"}
                    </span>
                    <span className={п.вид === "ok" ? "text-chalk" : "text-[#f3dca6]"}>{п.текст}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <a className="btn btn-primary" href={ссылка(разбор.большая.файл)} download>
                  Скачать основу {разбор.большая.ширина}×{разбор.большая.высота}
                </a>
                <a className="btn btn-ghost" href={ссылка(разбор.запасная.файл)} download>
                  Запасная {разбор.запасная.ширина}×{разбор.запасная.высота}
                </a>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setПравкаРамки((в) => !в)}
                >
                  {правкаРамки ? "Скрыть рамку" : "Поправить рамку"}
                </button>
              </div>

              {правкаРамки && рамка ? (
                <div className="grid gap-2 rounded-xl border border-line bg-raised p-3">
                  <p className="text-[12.5px] leading-relaxed text-muted">
                    Рамка в точках исходника {разбор.исходник.ширина}×{разбор.исходник.высота}.
                    Сверху отрезано {рамка.y}, снизу{" "}
                    {разбор.исходник.высота - рамка.y - рамка.h}.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ["x", "слева"],
                        ["y", "сверху"],
                        ["w", "ширина"],
                        ["h", "высота"],
                      ] as const
                    ).map(([ключ, подпись]) => (
                      <label key={ключ} className="grid gap-1 text-[12px] text-muted">
                        {подпись}
                        <input
                          type="number"
                          value={рамка[ключ]}
                          onChange={(e) =>
                            setРамка({ ...рамка, [ключ]: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="rounded-lg border border-line bg-void px-2.5 py-1.5 text-[13px] text-chalk outline-none focus:border-ember"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn btn-primary" onClick={() => void пересобрать()}>
                      Пересобрать по рамке
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setРамка(разбор.рамка)}
                    >
                      Вернуть найденную
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
