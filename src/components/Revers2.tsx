"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ToastStack, type Toast } from "@/components/ui";

import type { Проверка, РазборОсновы } from "@/lib/osnova/основа";
import {
  ПОДМЕНЫ_ПО_УМОЛЧАНИЮ,
  номераКартинок,
  чтоМеняем,
  type КлючПодмены,
  type Подмена,
} from "@/lib/osnova/подмены";
import { кадрыДляПакета, type КадрыДляПакета } from "@/lib/osnova/кадры";
import {
  какуюОснову,
  имяПакета,
  имяТренда,
  собратьПакет,
  собратьТренд,
  файлФишки,
} from "@/lib/osnova/пакет";
import { собратьШаблон, type Момент } from "@/lib/osnova/шаблон";
import { downloadBlob } from "@/lib/format";
import { createChoiceStore, useChoice } from "@/lib/prefs";
import { порядокЗагрузки } from "@/lib/osnova/подмены";
import {
  ПОЧЕМУ_НЕ_ПОДКЛЮЧЁН,
  генераторПодключён,
  подсказкаНастроек,
} from "@/lib/osnova/seedance";

/*  РЕВЕРС 2 — ГЛАВНЫЙ ПУТЬ.

    Ролик → фишка → Claude пишет шаблон → генерация → витрина. Всё
    прежнее (промпт, ДНК, раскадровка, «Для Seedance») никуда не делось
    — оно в свёрнутом блоке внизу.

    Пять блоков главного пути: видео-основа, фишка и подмены, шаблон от
    Claude, генерация с оценкой и витрина. Свёрнутые блоки — ручная
    настройка шаблона и все прежние инструменты.                      */

type Состояние = "пусто" | "идёт" | "готово" | "беда";

/*  Режим блока 3 помнится между заходами: пока API не подключён,
    владелец каждый раз работает вручную — незачем переключать.     */
const РЕЖИМ_CLAUDE = createChoiceStore<"hand" | "auto">(
  "revers.claude.mode",
  ["hand", "auto"],
  "hand",
);

export function Revers2() {
  /*  Короткие вести о ходе дела. Раньше их показывала общая обвязка
      старого экрана; теперь экран один, и они живут здесь.         */
  const [вести, setВести] = useState<Toast[]>([]);
  const onСообщение = useCallback(
    (вид: "success" | "error" | "info", заголовок: string, текст?: string) => {
      const id = `в-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setВести((п) => [...п, { id, tone: вид, title: заголовок, detail: текст }]);
      window.setTimeout(() => setВести((п) => п.filter((в) => в.id !== id)), 5000);
    },
    [],
  );

  const [состояние, setСостояние] = useState<Состояние>("пусто");
  const [разбор, setРазбор] = useState<РазборОсновы | null>(null);
  const [проверки, setПроверки] = useState<Проверка[]>([]);
  const [беда, setБеда] = useState<string | null>(null);
  const [правкаРамки, setПравкаРамки] = useState(false);
  const [рамка, setРамка] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const полеФайла = useRef<HTMLInputElement | null>(null);

  /*  Блок 2: фишка и что подменяем. Живёт рядом с основой — дальше по
      этим же данным собираются шаблон, список загрузки и пакет.     */
  const [фишка, setФишка] = useState("");
  const [подмены, setПодмены] = useState<Подмена[]>(ПОДМЕНЫ_ПО_УМОЛЧАНИЮ);
  const номера = номераКартинок(подмены);

  const переключить = useCallback((ключ: КлючПодмены) => {
    setПодмены((п) =>
      п.map((х) => (х.ключ === ключ ? { ...х, включена: !х.включена } : х)),
    );
  }, []);

  const вписать = useCallback((ключ: КлючПодмены, текст: string) => {
    setПодмены((п) => п.map((х) => (х.ключ === ключ ? { ...х, значение: текст } : х)));
  }, []);

  /*  Блок 3: Claude пишет шаблон. Пакет и запрос по API собираются из
      одних и тех же данных — разницы в содержимом быть не должно.   */
  const режимClaude = useChoice(РЕЖИМ_CLAUDE);
  const [шаблон, setШаблон] = useState("");
  const [пакетИдёт, setПакетИдёт] = useState(false);
  const [claudeИдёт, setClaudeИдёт] = useState(false);
  const [claudeСостояние, setClaudeСостояние] = useState("");
  const [claudeЕсть, setClaudeЕсть] = useState<boolean | null>(null);
  const [замок, setЗамок] = useState("");
  const [моменты, setМоменты] = useState<Момент[]>([]);
  const [баги, setБаги] = useState<string[]>([]);
  const кадрыRef = useRef<КадрыДляПакета | null>(null);
  /*  Смены движения держим и в состоянии: разметку рисуем из него, а
      не из ссылки — во время отрисовки ссылку читать нельзя.       */
  const [смены, setСмены] = useState<number[]>([]);

  /*  Блок 4: генерация и оценка. Счётчик испытания живёт на сервере —
      он один на все тренды и должен пережить перезагрузку.         */
  const [оценка, setОценка] = useState<"отлично" | "средне" | "плохо" | null>(null);
  const [чтоНеТак, setЧтоНеТак] = useState("");
  const [испытание, setИспытание] = useState<{ готово: number; всего: number }>({
    готово: 0,
    всего: 10,
  });

  /*  Блок 5: витрина. Связи с ней пока нет, поэтому тренд уезжает
      архивом — позже это станет прямой отправкой в админку.        */
  const [пример, setПример] = useState<File | null>(null);
  const [трендИдёт, setТрендИдёт] = useState(false);
  const полеПримера = useRef<HTMLInputElement | null>(null);

  const наВитрину = useCallback(async () => {
    if (!разбор) return;
    setТрендИдёт(true);
    try {
      const основы: Array<{ имя: string; blob: Blob }> = [];
      for (const файл of [разбор.большая.файл, разбор.запасная.файл]) {
        const о = await fetch(`/api/osnova/${разбор.id}/${encodeURIComponent(файл)}`);
        if (о.ok) основы.push({ имя: файл, blob: await о.blob() });
      }
      const архив = await собратьТренд({
        разбор,
        фишка,
        шаблон,
        подмены,
        основы,
        пример: пример ? { имя: `пример-${пример.name}`, blob: пример } : null,
      });
      downloadBlob(архив, имяТренда(разбор.имя));
      onСообщение(
        "success",
        "Тренд собран",
        "Позже этот архив будет уходить в админку витрины сам",
      );
    } catch (е) {
      onСообщение("error", "Тренд не собрался", е instanceof Error ? е.message : undefined);
    } finally {
      setТрендИдёт(false);
    }
  }, [разбор, фишка, шаблон, подмены, пример, onСообщение]);

  /*  Счёт испытания и записанные баги этого тренда — с сервера.    */
  const обновитьИспытание = useCallback(async () => {
    if (!разбор) return;
    try {
      const ответ = await fetch(`/api/ispytanie?id=${encodeURIComponent(разбор.id)}`);
      const д = (await ответ.json()) as { готово?: number; всего?: number; баги?: string[] };
      setИспытание({ готово: д.готово ?? 0, всего: д.всего ?? 10 });
      setБаги(д.баги ?? []);
    } catch {
      /* счётчик не критичен — экран работает и без него */
    }
  }, [разбор]);

  /*  Запрос за счётчиком начинаем не сразу: правило о состоянии в
      эффектах не отличает мгновенную запись от записи после ответа
      сервера, а лишний повторный показ нам ни к чему.              */
  useEffect(() => {
    const метка = window.setTimeout(() => void обновитьИспытание(), 0);
    return () => window.clearTimeout(метка);
  }, [обновитьИспытание]);

  const поставитьОценку = useCallback(
    async (новая: "отлично" | "средне" | "плохо", баг?: string) => {
      if (!разбор) return;
      setОценка(новая);
      try {
        const ответ = await fetch("/api/ispytanie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: разбор.id, имя: разбор.имя, оценка: новая, баг }),
        });
        const д = (await ответ.json()) as { готово?: number; всего?: number; баги?: string[] };
        setИспытание({ готово: д.готово ?? 0, всего: д.всего ?? 10 });
        setБаги(д.баги ?? []);
        if (новая === "отлично") onСообщение("success", "Засчитано «Отлично»");
      } catch (е) {
        onСообщение("error", "Оценка не записалась", е instanceof Error ? е.message : undefined);
      }
    },
    [разбор, onСообщение],
  );

  /*  Подключён ли Claude — спрашиваем сервер: ключ живёт только там. */
  useEffect(() => {
    let живы = true;
    fetch("/api/claude")
      .then((о) => о.json())
      .then((д: { подключён?: boolean }) => {
        if (живы) setClaudeЕсть(Boolean(д.подключён));
      })
      .catch(() => {
        if (живы) setClaudeЕсть(false);
      });
    return () => {
      живы = false;
    };
  }, []);

  /*  Кадры для пакета снимаем один раз на основу и держим: это
      десятки секунд работы, повторять их на каждую кнопку незачем. */
  const взятьКадры = useCallback(async (): Promise<КадрыДляПакета | null> => {
    if (!разбор) return null;
    if (кадрыRef.current) return кадрыRef.current;
    const готово = await кадрыДляПакета(разбор.id);
    кадрыRef.current = готово;
    setСмены(готово.смены);
    return готово;
  }, [разбор]);

  const заготовка = разбор
    ? собратьШаблон({ фишка, замок, моменты, подмены, баги })
    : "";

  const скачатьПакет = useCallback(async () => {
    if (!разбор) return;
    setПакетИдёт(true);
    try {
      const кадры = await взятьКадры();
      const какая = какуюОснову(разбор);
      const видеоОтвет = await fetch(
        `/api/osnova/${разбор.id}/${encodeURIComponent(какая.файл)}`,
      );
      const видео = видеоОтвет.ok ? await видеоОтвет.blob() : null;
      const прочти = await fetch("/ПРОЧТИ-claude.md")
        .then((о) => (о.ok ? о.text() : ""))
        .catch(() => "");

      const архив = await собратьПакет({
        разбор,
        фишка,
        замок,
        подмены,
        моменты,
        баги,
        смены: кадры?.смены ?? [],
        раскадровка: кадры?.раскадровка ?? null,
        кадры: (кадры?.ключевые ?? []).map((к) => ({ имя: к.имя, время: к.время, blob: к.blob })),
        прочти,
        видео: видео ? { имя: какая.файл, blob: видео } : null,
      });
      downloadBlob(архив, имяПакета(разбор.имя));
      onСообщение(
        "success",
        "Пакет собран",
        какая.запасная ? "Основа взята запасная — большая не влезает в чат" : undefined,
      );
    } catch (е) {
      onСообщение("error", "Пакет не собрался", е instanceof Error ? е.message : undefined);
    } finally {
      setПакетИдёт(false);
    }
  }, [разбор, фишка, замок, подмены, моменты, баги, взятьКадры, onСообщение]);

  const спроситьClaude = useCallback(
    async (правка?: { шаблон: string; баг: string }) => {
      if (!разбор) return;
      setClaudeИдёт(true);
      setClaudeСостояние(правка ? "Claude правит шаблон…" : "Claude пишет шаблон…");
      try {
        const кадры = правка ? null : await взятьКадры();
        const вBase64 = async (blob: Blob) => {
          const буфер = new Uint8Array(await blob.arrayBuffer());
          let строка = "";
          for (let i = 0; i < буфер.length; i += 1) строка += String.fromCharCode(буфер[i]);
          return btoa(строка);
        };
        const картинки: Array<{ имя: string; тип: string; данные: string }> = [];
        if (кадры) {
          картинки.push({
            имя: "раскадровка.jpg",
            тип: "image/jpeg",
            данные: await вBase64(кадры.раскадровка),
          });
          for (const к of кадры.ключевые.slice(0, 8)) {
            картинки.push({ имя: к.имя, тип: "image/jpeg", данные: await вBase64(к.blob) });
          }
        }

        const ответ = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            фишка: файлФишки({
              разбор,
              фишка,
              замок,
              подмены,
              моменты,
              баги,
              смены,
              раскадровка: null,
              кадры: [],
              прочти: "",
              видео: null,
            }),
            чтоМеняем: JSON.stringify(чтоМеняем(подмены, фишка), null, 2),
            днк: JSON.stringify(
              { длительность: разбор.исходник.длительность, смены },
              null,
              2,
            ),
            заготовка,
            картинки,
            правка,
          }),
        });
        const данные = (await ответ.json()) as { шаблон?: string; error?: string };
        if (!ответ.ok || !данные.шаблон) throw new Error(данные.error ?? `Сервер ответил ${ответ.status}`);
        setШаблон(данные.шаблон);
        setClaudeСостояние("готово");
        onСообщение("success", правка ? "Шаблон обновлён" : "Шаблон получен");
      } catch (е) {
        setClaudeСостояние("");
        onСообщение("error", "Claude не ответил", е instanceof Error ? е.message : undefined);
      } finally {
        setClaudeИдёт(false);
      }
    },
    [разбор, фишка, замок, подмены, моменты, баги, смены, заготовка, взятьКадры, onСообщение],
  );

  const принятьФайл = useCallback(
    async (файл: File) => {
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
    [onСообщение],
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

      {/* ---------- 2 · фишка и что меняем ---------- */}
      {разбор ? (
        <section className="panel p-4">
          <p className="hud-label">2 · Фишка и что меняем</p>

          <label className="mt-3 grid gap-1.5">
            <span className="text-[12.5px] text-muted">
              В чём фишка — одной строкой (можно по-русски, Claude переведёт)
            </span>
            <input
              value={фишка}
              onChange={(e) => setФишка(e.target.value)}
              placeholder="например: лихо крутится на турнике, очки слетают, в конце держится за голову и смеётся"
              className="w-full rounded-lg border border-edge bg-[#0a0a0f] px-3 py-2.5 text-[14px] text-chalk outline-none focus:border-ember"
            />
          </label>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {подмены.map((п) => (
              <div
                key={п.ключ}
                className={`grid grid-cols-[38px_minmax(0,1fr)] gap-2.5 rounded-xl border p-3 transition ${
                  п.включена ? "border-ember/40 bg-ember/6" : "border-line bg-raised"
                }`}
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={п.включена}
                  aria-label={п.имя}
                  onClick={() => переключить(п.ключ)}
                  className={`mt-0.5 h-5 w-9 rounded-full border transition ${
                    п.включена ? "border-ember bg-ember/70" : "border-edge bg-void"
                  }`}
                >
                  <span
                    className={`block h-3.5 w-3.5 rounded-full bg-chalk transition-transform ${
                      п.включена ? "translate-x-[18px]" : "translate-x-[3px]"
                    }`}
                  />
                </button>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="text-[13.5px] text-chalk">{п.имя}</b>
                    {п.включена && п.скартинкой ? (
                      <span className="rounded-md border border-ember/35 bg-ember/14 px-1.5 py-0.5 font-mono text-[11.5px] text-ember">
                        @image{номера[п.ключ]}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted">{п.пояснение}</p>

                  {п.поле && п.включена ? (
                    <label className="mt-2 grid gap-1">
                      <span className="text-[11.5px] text-dim">{п.поле}</span>
                      <input
                        value={п.значение ?? ""}
                        onChange={(e) => вписать(п.ключ, e.target.value)}
                        className="w-full rounded-lg border border-edge bg-[#0a0a0f] px-2.5 py-1.5 text-[13px] text-chalk outline-none focus:border-ember"
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-2.5 text-[12px] leading-relaxed text-dim">
            Номера @image идут по порядку включённых пунктов с фотографией. Одежда задаётся
            текстом и номера не получает. Выключите пункт — номера пересчитаются везде: и в
            списке загрузки, и в шаблоне.
          </p>
        </section>
      ) : null}

      {/* ---------- 3 · Claude пишет шаблон ---------- */}
      {разбор ? (
        <section className="panel border-ice/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="hud-label">3 · Claude пишет шаблон</p>
            <div className="inline-flex gap-0.5 rounded-xl border border-line bg-[#0a0a0f] p-0.5">
              {(
                [
                  ["hand", "Сейчас: вручную"],
                  ["auto", "Потом: автоматически"],
                ] as const
              ).map(([ключ, имя]) => (
                <button
                  key={ключ}
                  type="button"
                  aria-pressed={режимClaude === ключ}
                  onClick={() => РЕЖИМ_CLAUDE.save(ключ)}
                  className={`rounded-lg px-2.5 py-1.5 text-[13px] ${
                    режимClaude === ключ ? "bg-raised text-chalk" : "text-muted hover:text-chalk"
                  }`}
                >
                  {имя}
                </button>
              ))}
            </div>
          </div>

          {режимClaude === "hand" ? (
            <div className="mt-3 grid gap-2.5">
              <ol className="grid gap-1.5 text-[13px] text-muted">
                {[
                  "Скачайте пакет: видео-основа, раскадровка, кадры, ДНК, фишка и задача для Claude",
                  "Отправьте архив Claude в чат",
                  "Вставьте ответ Claude в поле ниже",
                ].map((шаг, i) => (
                  <li key={шаг} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2">
                    <span className="font-mono text-dim">{i + 1}</span>
                    <span>{шаг}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void скачатьПакет()}
                  disabled={пакетИдёт || !фишка.trim()}
                  title={!фишка.trim() ? "Сначала впишите фишку в блоке 2" : undefined}
                >
                  {пакетИдёт ? "Собираем пакет…" : "Скачать пакет для Claude"}
                </button>
                {пакетИдёт ? (
                  <span className="text-[12.5px] text-muted">
                    снимаем раскадровку и кадры — это занимает с полминуты
                  </span>
                ) : !фишка.trim() ? (
                  /*  Без фишки пакет бессмыслен: Claude по нему напишет
                      шаблон «ни о чём». Лучше не дать нажать.        */
                  <span className="text-[12.5px] text-flare">
                    Сначала впишите фишку в блоке 2
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="mt-3 grid gap-2.5">
              <p className="text-[13px] leading-relaxed text-muted">
                Сайт сам отправляет пакет в Claude и получает шаблон. Ключ API живёт на
                сервере, в настройках.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void спроситьClaude()}
                  disabled={claudeИдёт || claudeЕсть === false || !фишка.trim()}
                  title={
                    claudeЕсть === false
                      ? "Claude не подключён — работайте вручную"
                      : !фишка.trim()
                        ? "Сначала впишите фишку в блоке 2"
                        : undefined
                  }
                >
                  {claudeИдёт ? "Claude пишет…" : "Отправить Claude"}
                </button>
                <span className="text-[12.5px] text-dim">
                  {claudeЕсть === false
                    ? "Claude не подключён — работайте вручную"
                    : !фишка.trim()
                      ? "Сначала впишите фишку в блоке 2"
                      : claudeСостояние}
                </span>
              </div>
            </div>
          )}

          <label className="mt-3 grid gap-1.5">
            <span className="text-[12.5px] text-muted">Шаблон от Claude</span>
            <textarea
              value={шаблон}
              onChange={(e) => setШаблон(e.target.value)}
              placeholder="Сюда вставляется (или приходит сам) шаблон «поверх оригинала»"
              className="min-h-[180px] w-full rounded-xl border border-edge bg-[#0a0a0f] p-3 font-mono text-[12px] leading-relaxed text-[#e6e3f0] outline-none focus:border-ember"
            />
          </label>
        </section>
      ) : null}

      {/* ---------- 4 · генерация и оценка ---------- */}
      {разбор ? (
        <section className="panel p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="hud-label">4 · Генерация</p>
            <span className="rounded-full bg-ice/12 px-2.5 py-1 font-mono text-[12px] text-ice">
              {подсказкаНастроек({
                формат: разбор.вертикальный ? "9:16" : "16:9",
                секунды: разбор.исходник.длительность,
                модель: "Seedance 2.5",
              })}
            </span>
          </div>

          {режимClaude === "hand" ? (
            <div className="mt-3 grid gap-2.5">
              <p className="text-[12.5px] text-dim">
                Загрузите в SYNTX в таком порядке и вставьте шаблон:
              </p>
              <div className="grid gap-1.5">
                {порядокЗагрузки(подмены).map((с) => (
                  <div
                    key={с.метка}
                    className="grid grid-cols-[86px_minmax(0,1fr)] gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[13px]"
                  >
                    <span className="font-mono text-ember">{с.метка}</span>
                    <span className="text-chalk">{с.что}</span>
                  </div>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const т = шаблон.trim();
                    if (!т) {
                      onСообщение("info", "Сначала шаблон в блоке 3");
                      return;
                    }
                    void navigator.clipboard
                      .writeText(т)
                      .then(() => onСообщение("success", "Шаблон скопирован"))
                      .catch(() => onСообщение("error", "Буфер недоступен — выделите и скопируйте"));
                  }}
                >
                  Копировать шаблон
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-primary cursor-not-allowed opacity-45"
                disabled
                title={ПОЧЕМУ_НЕ_ПОДКЛЮЧЁН}
              >
                Отправить в Seedance · пробно
              </button>
              <span className="text-[12.5px] text-dim">
                {генераторПодключён() ? "" : ПОЧЕМУ_НЕ_ПОДКЛЮЧЁН}
              </span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="hud-label">Оценка результата</span>
            <span className="font-mono text-[12.5px] text-dim">
              испытание: {испытание.готово} из {испытание.всего}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["отлично", "Отлично"],
                ["средне", "Средне — доработать"],
                ["плохо", "Плохо"],
              ] as const
            ).map(([ключ, имя]) => (
              <button
                key={ключ}
                type="button"
                aria-pressed={оценка === ключ}
                onClick={() => void поставитьОценку(ключ)}
                className={`btn ${оценка === ключ ? "btn-primary" : "btn-ghost"}`}
              >
                {имя}
              </button>
            ))}
          </div>

          {оценка === "средне" || оценка === "плохо" ? (
            <div className="mt-3 grid gap-2 rounded-xl border border-line bg-raised p-3">
              <label className="grid gap-1.5">
                <span className="text-[12.5px] text-muted">Что не так</span>
                <input
                  value={чтоНеТак}
                  onChange={(e) => setЧтоНеТак(e.target.value)}
                  placeholder="например: длинные волосы, стоит в начале, 16:9"
                  className="w-full rounded-lg border border-edge bg-[#0a0a0f] px-2.5 py-2 text-[13.5px] text-chalk outline-none focus:border-ember"
                />
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={claudeИдёт}
                  onClick={() => {
                    const баг = чтоНеТак.trim();
                    if (!баг) {
                      onСообщение("info", "Опишите, что не так");
                      return;
                    }
                    void поставитьОценку(оценка, баг).then(() => {
                      setЧтоНеТак("");
                      if (режимClaude === "auto" && claudeЕсть) {
                        void спроситьClaude({ шаблон, баг });
                      } else {
                        onСообщение(
                          "success",
                          "Баг записан",
                          "Он попадёт в фишка.txt следующего пакета",
                        );
                      }
                    });
                  }}
                >
                  Отправить Claude на доработку
                </button>
                <span className="text-[12px] text-dim">
                  вручную — баг попадёт в пакет; автоматически — Claude сам поправит шаблон
                </span>
              </div>

              {баги.length ? (
                <div className="text-[12.5px] text-muted">
                  Записано по этому тренду: {баги.map((б) => `«${б}»`).join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------- 5 · витрина ---------- */}
      {разбор ? (
        <section className="panel p-4">
          <p className="hud-label">5 · Витрина</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={оценка !== "отлично" || трендИдёт}
              onClick={() => void наВитрину()}
              title={оценка !== "отлично" ? "Доступно после оценки «Отлично»" : undefined}
            >
              {трендИдёт ? "Собираем тренд…" : "На витрину"}
            </button>

            <input
              ref={полеПримера}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                setПример(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => полеПримера.current?.click()}
            >
              {пример ? "Заменить пример результата" : "Приложить пример результата"}
            </button>
            {пример ? (
              <span className="font-mono text-[12px] text-dim">{пример.name}</span>
            ) : null}
          </div>

          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            {оценка === "отлично"
              ? "Уходит архивом: обе видео-основы, итоговый шаблон, список фото для клиента и пример результата. Прямой связи с витриной пока нет — позже эта кнопка будет отправлять тренд в админку сама."
              : "Доступно после «Отлично». Уходит: видео-основа, шаблон, список фото для клиента, пример результата."}
          </p>
        </section>
      ) : null}

      <ToastStack toasts={вести} onDismiss={(id) => setВести((п) => п.filter((в) => в.id !== id))} />

      {/* ---------- свёрнуто: ручная настройка шаблона ---------- */}
      {разбор ? (
        <details className="panel overflow-hidden">
          <summary className="cursor-pointer px-4 py-3 font-display text-[13.5px] font-bold uppercase tracking-[0.07em] text-chalk">
            Ручная настройка шаблона (без Claude)
            <span className="ml-2 font-body text-[12px] font-normal normal-case tracking-normal text-dim">
              замок, моменты, шаблон кодом
            </span>
          </summary>

          <div className="grid gap-3 border-t border-line-soft p-4">
            <label className="grid gap-1.5">
              <span className="text-[12.5px] text-muted">
                Что в кадре нельзя менять (форма и место) — по-английски
              </span>
              <input
                value={замок}
                onChange={(e) => setЗамок(e.target.value)}
                placeholder="the low metal bar at hip height on blue painted posts"
                className="w-full rounded-lg border border-edge bg-[#0a0a0f] px-3 py-2 text-[13.5px] text-chalk outline-none focus:border-ember"
              />
            </label>

            {/*  Шкала времени: пунктиром — смены движения, которые нашёл
                 РЕВЕРС, точками — моменты, вписанные руками.         */}
            <div>
              <p className="hud-label">Шкала времени</p>
              <div className="relative mt-1.5 h-12 overflow-hidden rounded-lg border border-line bg-raised">
                {смены.map((т) => (
                  <span
                    key={`смена-${т}`}
                    title={`смена движения ${т.toFixed(2)} с`}
                    className="absolute inset-y-0 w-px border-l border-dashed border-ice/70"
                    style={{ left: `${(т / Math.max(0.1, разбор.исходник.длительность)) * 100}%` }}
                  />
                ))}
                {моменты.map((м, i) => (
                  <span
                    key={`момент-${i}`}
                    title={м.что}
                    className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                      м.фишка ? "bg-flare" : "bg-ember"
                    }`}
                    style={{
                      left: `${(м.время / Math.max(0.1, разбор.исходник.длительность)) * 100}%`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between font-mono text-[11px] text-dim">
                <span>0</span>
                <span>{разбор.исходник.длительность.toFixed(1)} с</span>
              </div>
            </div>

            <div>
              <p className="hud-label">Моменты</p>
              <div className="mt-1.5 grid gap-1.5">
                {моменты.map((м, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[72px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border px-2 py-1.5 ${
                      м.фишка ? "border-flare/45 bg-flare/6" : "border-line bg-raised"
                    }`}
                  >
                    <input
                      type="number"
                      step="0.1"
                      value={м.время}
                      aria-label="время, сек"
                      onChange={(e) =>
                        setМоменты((п) =>
                          п.map((х, j) =>
                            j === i ? { ...х, время: Math.max(0, Number(e.target.value) || 0) } : х,
                          ),
                        )
                      }
                      className="rounded border border-line bg-void px-1.5 py-1 font-mono text-[12.5px] text-chalk outline-none focus:border-ember"
                    />
                    <input
                      value={м.что}
                      aria-label="что происходит"
                      placeholder="what happens — по-английски"
                      onChange={(e) =>
                        setМоменты((п) => п.map((х, j) => (j === i ? { ...х, что: e.target.value } : х)))
                      }
                      className="w-full rounded border border-line bg-void px-2 py-1 text-[13px] text-chalk outline-none focus:border-ember"
                    />
                    <button
                      type="button"
                      aria-pressed={Boolean(м.фишка)}
                      title="Это и есть фишка"
                      onClick={() =>
                        setМоменты((п) => п.map((х, j) => (j === i ? { ...х, фишка: !х.фишка } : х)))
                      }
                      className={`rounded px-2 py-1 text-[12px] ${
                        м.фишка ? "bg-flare/20 text-flare" : "text-dim hover:text-chalk"
                      }`}
                    >
                      фишка
                    </button>
                    <button
                      type="button"
                      title="Удалить"
                      onClick={() => setМоменты((п) => п.filter((_, j) => j !== i))}
                      className="px-1.5 text-[15px] text-dim hover:text-bad"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setМоменты((п) => [...п, { время: 0, что: "" }])}
                >
                  + Момент
                </button>
                {смены.length ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() =>
                      setМоменты((п) => {
                        const было = new Set(п.map((м) => м.время.toFixed(2)));
                        const новые = смены
                          .filter((т) => !было.has(т.toFixed(2)))
                          .map((т) => ({ время: т, что: "" }));
                        return [...п, ...новые].sort((a, b) => a.время - b.время);
                      })
                    }
                  >
                    Взять смены движения
                  </button>
                ) : null}
              </div>
            </div>

            <div>
              <p className="hud-label">Шаблон, собранный кодом</p>
              <pre className="mt-1.5 max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-edge bg-[#0a0a0f] p-3 font-mono text-[12px] leading-relaxed text-[#e6e3f0]">
                {заготовка}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(заготовка)
                    .then(() => onСообщение("success", "Скопировано"))
                    .catch(() => onСообщение("error", "Буфер недоступен — выделите и скопируйте"))
                }
              >
                Копировать
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setШаблон(заготовка);
                  onСообщение("success", "Подставлено в блок 3");
                }}
              >
                Подставить в блок 3
              </button>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
