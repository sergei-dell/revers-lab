import { CAMERA_LABELS } from "@/lib/video/analyze";
import { ЗАПРЕТЫ_НАДПИСЕЙ, строкиБезНадписей } from "@/lib/lettering";
import type { Analysis, VideoMeta } from "@/lib/types";

// ШАБЛОН СО СЛОТАМИ — четвёртый режим промпта.
//
// Собирает промпт под съёмку с референсами: вместо человека, предмета и
// места в текст ставятся слоты [ФОТО ГЕРОЯ], [ФОТО ПРОДУКТА], [ФОТО
// ЛОКАЦИИ], а сам кадр описывается тем, что увидела модель и измерил
// движок. Слот ставится только тогда, когда в кадре есть что заменять:
// нет человека — нет и слота.
//
// Заголовки блоков (REFERENCES, CORE SCENE, GLOBAL, TIMELINE, INVARIANT)
// одинаковы в русской и английской версии: это ключевые слова шаблона, по
// ним генератор и разбирает промпт.

export const SLOT_HERO = "[ФОТО ГЕРОЯ]";
export const SLOT_PRODUCT = "[ФОТО ПРОДУКТА]";
export const SLOT_PLACE = "[ФОТО ЛОКАЦИИ]";

export type TemplateSource = {
  /** описание сцены от модели */
  answer: {
    ru: string;
    en: string;
    subject: string;
    environment: string;
    camera: string;
    light: string;
    color: string;
    texture: string;
    cameraEn?: string;
    lightEn?: string;
    colorEn?: string;
    textureEn?: string;
    action: Array<{ t: string; beat: string }>;
    actionEn?: Array<{ t: string; beat: string }>;
    negative: string;
  };
  analysis: Analysis | null;
  meta: VideoMeta | null;
  /** «--ar 16:9 --duration 10» из промпта измерений */
  flags: string;
  /*  СКВОЗНЫЕ БЛОКИ при разборе по отрезкам. GLOBAL, Exclusions и
      INVARIANT считаются один раз по всему ролику и в каждый отрезок
      попадают одинаковыми: иначе куски генерируются в разном стиле и не
      склеиваются в один ролик. Меняются только CORE SCENE и TIMELINE. */
  shared?: {
    /** поля разбора, собранные по всем отрезкам */
    answer: {
      camera: string;
      light: string;
      color: string;
      texture: string;
      cameraEn: string;
      lightEn: string;
      colorEn: string;
      textureEn: string;
      negative: string;
    };
    /** какие слоты вообще есть в ролике: одинаковые во всех отрезках */
    slots: { hero: boolean; product: boolean; place: boolean };
  };
  /** границы отрезка: его время в TIMELINE и его планы */
  range?: { start: number; end: number };
  /** выбранный стилевой пресет: строка Style в блоке GLOBAL */
  style: { ru: string; en: string };
};

/*  Границы слова в JavaScript знают только латиницу: «\bженщина» не
    находит в тексте ничего. Поэтому границы и окончания заданы буквами
    Unicode — из-за этой мелочи слоты [ФОТО ГЕРОЯ] и [ФОТО ПРОДУКТА] не
    ставились вовсе.                                                  */
const ХВОСТ = "\\p{L}*";
const край = (слова: string[]) =>
  new RegExp(`(?<!\\p{L})(?:${слова.join("|")})(?!\\p{L})`, "iu");

const ЛЮДИ = край([
  "человек", "люди", `мужчин${ХВОСТ}`, `женщин${ХВОСТ}`, `девушк${ХВОСТ}`, `парн${ХВОСТ}`,
  `парен${ХВОСТ}`, "герой", `героин${ХВОСТ}`, `персонаж${ХВОСТ}`, "модель", "ребёнок", "дети",
  `подрост${ХВОСТ}`, `танцор${ХВОСТ}`, `бегун${ХВОСТ}`,
  "man", "men", "woman", "women", "girl", "boy", "person", "people", "guy", "model",
  "teenager", "child", "kid", "figure", "dancer", "runner",
]);

const ПРЕДМЕТЫ = край([
  `бутылк${ХВОСТ}`, `банк${ХВОСТ}`, `коробк${ХВОСТ}`, `упаковк${ХВОСТ}`, `флакон${ХВОСТ}`,
  `тюбик${ХВОСТ}`, `стакан${ХВОСТ}`, `чашк${ХВОСТ}`, `телефон${ХВОСТ}`, `смартфон${ХВОСТ}`,
  `кроссовк${ХВОСТ}`, "часы", `сумк${ХВОСТ}`, `продукт${ХВОСТ}`, `товар${ХВОСТ}`,
  `устройств${ХВОСТ}`, `гаджет${ХВОСТ}`,
  "bottle", "can", "jar", "box", "package", "tube", "flask", "cup", "mug", "phone",
  "smartphone", "sneaker", "shoe", "watch", "bag", "product", "device", "gadget", "perfume",
]);

const ПОВЕРХНОСТИ = край([
  `стен${ХВОСТ}`, `стол${ХВОСТ}`, `столешниц${ХВОСТ}`, "пол", `витрин${ХВОСТ}`, `окн${ХВОСТ}`,
  `экран${ХВОСТ}`, "дверь", `фасад${ХВОСТ}`, `борт${ХВОСТ}`, `парапет${ХВОСТ}`,
  "wall", "table", "counter", "desk", "floor", "window", "screen", "door", "facade", "panel",
  "surface", "parapet",
]);

/*  Модель нередко прямо говорит, что людей нет. Слово «людей» в такой
    фразе не должно включать слот героя.                              */
const НЕТ_ЛЮДЕЙ =
  /(?:без люд|люд[а-я]* (?:в кадре )?нет|нет люд|никого нет|no people|without people|no person|empty of people)/iu;

const МЕСТА = край([
  `улиц${ХВОСТ}`, `набережн${ХВОСТ}`, `комнат${ХВОСТ}`, `помещени${ХВОСТ}`, `кухн${ХВОСТ}`,
  `спальн${ХВОСТ}`, `офис${ХВОСТ}`, `студи${ХВОСТ}`, `парк${ХВОСТ}`, `двор${ХВОСТ}`,
  `берег${ХВОСТ}`, `залив${ХВОСТ}`, `город${ХВОСТ}`, `интерьер${ХВОСТ}`, `пейзаж${ХВОСТ}`,
  "street", "embankment", "room", "interior", "kitchen", "bedroom", "office", "studio", "park",
  "yard", "shore", "bay", "city", "landscape", "waterfront",
]);

/*  Модель отвечает абзацем, а в CORE SCENE нужна одна мысль. Берём то
    предложение, где она назвала главное: сперва человека, потом предмет.
    Первое подряд не годится — человек у модели часто во втором.       */
function sentences(text: string): string[] {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickSentence(text: string, keywords: RegExp | null): string {
  const список = sentences(text);
  if (!список.length) return "";
  if (!keywords) return список[0];
  return список.find((s) => keywords.test(s)) ?? список[0];
}

/*  ПОДСТАНОВКА СЛОТА. Меняем не весь кусок предложения, а только то, что
    описывает внешность, предмет или место: слово-примету вместе с её
    определениями. Действие человека — «идёт к камере» — остаётся, иначе
    из сцены пропадает само событие.                                   */
// «в красном дождевике», «со стаканом»: описание при слове-примете.
const ОПИСАНИЕ_ПРИ = `(?:в|во|с|со|из|на)\\s+\\p{L}+(?:\\s+\\p{L}+)?`;

function replaceNear(sentence: string, keywords: RegExp, slot: string): { text: string; used: boolean } {
  const найдено = sentence.match(keywords);
  if (!найдено || найдено.index === undefined) return { text: sentence, used: false };
  const начало = найдено.index;
  const конец = начало + найдено[0].length;
  /*  Слева забираем только определения: «молодая женщина», «стеклянная
      бутылка», «a young woman». Глаголы и другие существительные не
      трогаем — иначе из сцены пропадает действие: «в кадр входит мужчина»
      превращалось в один слот.                                        */
  const ОПРЕДЕЛЕНИЕ = /(?:\p{L}*(?:ый|ий|ой|ая|яя|ое|ее|ые|ие|ого|ому)|a|an|the|young|old|tall|small|big|new)$/iu;
  const словаСлева = sentence.slice(0, начало).trimEnd().split(/\s+/);
  let взято = 0;
  while (взято < 2 && словаСлева.length - взято > 0) {
    const слово = словаСлева[словаСлева.length - 1 - взято];
    if (!слово || !ОПРЕДЕЛЕНИЕ.test(слово.replace(/[^\p{L}]/gu, ""))) break;
    взято += 1;
  }
  const длинаСлева = взято
    ? словаСлева.slice(словаСлева.length - взято).join(" ").length + взято
    : 0;
  const срез = начало - длинаСлева;
  // Описание справа: «лет тридцати», «в красном дождевике», «wearing a coat».
  const хвост = sentence
    .slice(конец)
    .match(new RegExp(`^(?:\\s+лет\\s+\\p{L}+)?(?:,?\\s+${ОПИСАНИЕ_ПРИ})?(?:\\s+(?:wearing|holding|with)\\s+[^,.;]+)?`, "iu"));
  const доКонца = конец + (хвост ? хвост[0].length : 0);
  const текст = `${sentence.slice(0, срез)}${slot}${sentence.slice(доКонца)}`.replace(/\s+/g, " ").trim();
  return { text: текст, used: true };
}

function timecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const м = Math.floor(s / 60);
  const сек = (s - м * 60).toFixed(1).padStart(4, "0");
  return `${String(м).padStart(2, "0")}:${сек}`;
}

/*  Какой такт модели попадает в этот план: берём тот, чьё время ближе к
    середине плана. Модель делит ролик своими отрезками, склейки движок
    находит своими — точного совпадения не бывает.                    */
function beatFor(action: TemplateSource["answer"]["action"], middle: number): string {
  if (!action.length) return "";
  let лучший = action[0];
  let ближе = Infinity;
  for (const такт of action) {
    const числа = (такт.t.match(/[\d.]+/g) ?? []).map(Number).filter((n) => Number.isFinite(n));
    if (!числа.length) continue;
    const центр = числа.length > 1 ? (числа[0] + числа[1]) / 2 : числа[0];
    const d = Math.abs(центр - middle);
    if (d < ближе) {
      ближе = d;
      лучший = такт;
    }
  }
  return лучший.beat;
}

function surfaceWord(source: TemplateSource, lang: "ru" | "en"): string {
  const текст = `${source.answer.environment} ${source.answer.texture}`;
  const найдено = текст.match(ПОВЕРХНОСТИ);
  // В английский промпт русское слово не ставим: генератор его не поймёт.
  if (найдено && !(lang === "en" && /[а-яё]/i.test(найдено[0]))) return найдено[0];
  return lang === "ru" ? "свободная плоская поверхность" : "free flat surface";
}

/*  Какие слоты есть у ролика вообще. Считается один раз по всем ответам
    модели, чтобы у отрезков был один набор референсов.               */
/*  Разбор готового шаблона на блоки: нужен, чтобы склеить все отрезки в
    один текст — сквозные блоки сверху один раз, дальше сцены по порядку. */
export function splitTemplate(text: string): {
  shared: string;
  perSegment: string;
} {
  const строки = text.split("\n");
  const сквозные: string[] = [];
  const своё: string[] = [];
  let куда: "shared" | "own" = "shared";
  for (const строка of строки) {
    if (/^CORE SCENE:/.test(строка)) куда = "own";
    else if (/^GLOBAL:/.test(строка)) куда = "shared";
    else if (/^TIMELINE:/.test(строка)) куда = "own";
    else if (/^INVARIANT:/.test(строка)) куда = "shared";
    else if (/^--ar /.test(строка)) куда = "own";
    (куда === "shared" ? сквозные : своё).push(строка);
  }
  const подчистить = (список: string[]) => список.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return { shared: подчистить(сквозные), perSegment: подчистить(своё) };
}

export function слотыРолика(текст: string): { hero: boolean; product: boolean; place: boolean } {
  return {
    hero: ЛЮДИ.test(текст) && !НЕТ_ЛЮДЕЙ.test(текст),
    product: ПРЕДМЕТЫ.test(текст),
    place: МЕСТА.test(текст) || Boolean(текст.trim()),
  };
}

export function buildTemplatePrompt(source: TemplateSource): { ru: string; en: string } {
  const сделать = (lang: "ru" | "en") => {
    const a = source.analysis;
    const ответ = source.answer;
    const описание = lang === "ru" ? ответ.ru : ответ.en;

    // ── какие слоты уместны ──────────────────────────────────────────
    // Смотрим весь ответ модели: она называет героя и предмет где угодно —
    // в subject, в описании среды, во второй фразе промпта.
    const всёОписание = `${ответ.subject} ${ответ.environment} ${описание}`;
    const своиСлоты = {
      hero: ЛЮДИ.test(всёОписание) && !НЕТ_ЛЮДЕЙ.test(всёОписание),
      product: ПРЕДМЕТЫ.test(всёОписание),
      place: Boolean(ответ.environment.trim()) || МЕСТА.test(всёОписание),
    };
    // Сквозные слоты задают, какие референсы есть у ролика вообще; в самом
    // отрезке слот ставится там, где ему есть что заменить.
    const нуженГерой = своиСлоты.hero;
    const нуженПродукт = своиСлоты.product;
    const нужноМесто = своиСлоты.place || Boolean(source.shared?.slots.place);

    const основа =
      pickSentence(описание, нуженГерой ? ЛЮДИ : нуженПродукт ? ПРЕДМЕТЫ : null) || ответ.subject;
    let ядро = основа;

    const герой = нуженГерой ? replaceNear(ядро, ЛЮДИ, SLOT_HERO) : { text: ядро, used: false };
    ядро = герой.text;
    let продуктПоставлен = false;
    if (нуженПродукт) {
      const шаг = replaceNear(ядро, ПРЕДМЕТЫ, SLOT_PRODUCT);
      ядро = шаг.text;
      продуктПоставлен = шаг.used;
      if (!продуктПоставлен) {
        // Предмет назван в другой части ответа — дописываем одной фразой.
        ядро = `${ядро.replace(/[.\s]+$/, "")}${lang === "ru" ? `, в руках ${SLOT_PRODUCT}` : `, holding ${SLOT_PRODUCT}`}.`;
        продуктПоставлен = true;
      }
    }
    let местоПоставлено = false;
    if (нужноМесто) {
      const шаг = replaceNear(ядро, МЕСТА, SLOT_PLACE);
      ядро = шаг.text;
      местоПоставлено = шаг.used;
      if (!местоПоставлено) {
        ядро = `${ядро.replace(/[.\s]+$/, "")}${lang === "ru" ? ` в ${SLOT_PLACE}` : ` in ${SLOT_PLACE}`}.`;
        местоПоставлено = true;
      }
    }
    // Героя модель назвала, но в выбранной фразе его нет — ставим впереди.
    let геройПоставлен = герой.used;
    if (нуженГерой && !геройПоставлен) {
      ядро = `${SLOT_HERO} — ${ядро}`;
      геройПоставлен = true;
    }
    const слоты = [
      геройПоставлен ? SLOT_HERO : "",
      продуктПоставлен ? SLOT_PRODUCT : "",
      местоПоставлено ? SLOT_PLACE : "",
    ].filter(Boolean);

    // ── REFERENCES ───────────────────────────────────────────────────
    // Список референсов у ролика один: он не может меняться от отрезка к
    // отрезку, иначе куски снимаются по разным исходникам.
    const общиеСлотыДляСсылок = source.shared?.slots;
    const показать = {
      hero: общиеСлотыДляСсылок ? общиеСлотыДляСсылок.hero : геройПоставлен,
      product: общиеСлотыДляСсылок ? общиеСлотыДляСсылок.product : продуктПоставлен,
      place: общиеСлотыДляСсылок ? общиеСлотыДляСсылок.place : местоПоставлено,
    };
    const references: string[] = [];
    if (показать.hero) {
      references.push(
        `${SLOT_HERO} defines face, hair, skin tone and build.`,
        "Do not use its background, clothing or lighting.",
      );
    }
    if (показать.product) {
      references.push(
        `${SLOT_PRODUCT} defines the exact object: shape, proportions, materials, colour.`,
        "Do not reproduce any printed text on it, render surfaces blank. Do not use its background.",
      );
    }
    if (показать.place) {
      references.push(
        `${SLOT_PLACE} defines the environment only: surfaces, depth, light sources.`,
        "Do not take people or objects from it.",
      );
    }

    // ── GLOBAL ───────────────────────────────────────────────────────
    // По строке на параметр: сплошную строку через точку с запятой
    // генератор разбирает хуже, да и глазом её не прочесть.
    const камера = a ? (CAMERA_LABELS[a.camera] ?? { ru: "камера не определена", en: "camera undetermined" }) : null;
    const палитра = (a?.palette ?? []).slice(0, 5).map((p) => p.hex).join(", ");
    const общий = source.shared?.answer;
    /*  В английский блок идут английские поля модели: раньше сюда
        попадал её русский текст — «средний план, 35 мм» в EN-промпте. */
    const поле = (имя: "camera" | "light" | "color" | "texture") => {
      const англ = `${имя}En` as "cameraEn" | "lightEn" | "colorEn" | "textureEn";
      const источник = общий ?? ответ;
      const значение = lang === "en" ? (источник[англ] ?? "").trim() || источник[имя] : источник[имя];
      return (значение ?? "").trim();
    };
    const стиль = (lang === "ru" ? source.style.ru : source.style.en).trim();
    const движение = камера ? (lang === "ru" ? камера.ru : камера.en) : "";
    const строкаКамеры = [поле("camera"), движение].filter(Boolean).join(", ");
    const строкаЦвета = [поле("color"), палитра].filter(Boolean).join(", ");
    const global = [
      стиль ? `Style: ${стиль}` : "",
      строкаКамеры ? `Camera: ${строкаКамеры}` : "",
      поле("light") ? `Light: ${поле("light")}` : "",
      строкаЦвета ? `Colour: ${строкаЦвета}` : "",
      поле("texture") ? `Texture: ${поле("texture")}` : "",
    ].filter(Boolean);

    /*  ЗАПРЕТЫ ЦЕЛИКОМ. Раньше список обрезался десятью позициями, и
        половина негатива от модели пропадала. Берём всё, что она вернула,
        плюс наши постоянные запреты, без повторов.                   */
    const запреты: string[] = [];
    const видели = new Set<string>();
    const негатив = общий ? общий.negative : ответ.negative;
    for (const кусок of [
      "no text, no letters, no logos, no watermarks",
      // Слова про надписи на предметах держим здесь постоянно.
      ЗАПРЕТЫ_НАДПИСЕЙ.join(", "),
      негатив,
    ]
      .join(", ")
      .split(/[,;\n]/)) {
      const чистый = кусок.trim().replace(/\s+/g, " ");
      const ключ = чистый.toLowerCase();
      if (!чистый || видели.has(ключ)) continue;
      видели.add(ключ);
      запреты.push(чистый);
    }

    const обереги = строкиБезНадписей(ответ);

    // ── TIMELINE ─────────────────────────────────────────────────────
    const отрезок = source.range;
    const всеСцены = a?.scenes?.length
      ? a.scenes
      : [{ index: 0, start: 0, end: source.meta?.durationSec ?? 0, keyframe: 0, intensity: 0 }];
    // У отрезка в TIMELINE только его планы и его время.
    const внутри = отрезок
      ? всеСцены
          .filter((с) => с.end > отрезок.start && с.start < отрезок.end)
          .map((с) => ({ ...с, start: Math.max(с.start, отрезок.start), end: Math.min(с.end, отрезок.end) }))
      : всеСцены;
    const сцены = внутри.length
      ? внутри
      : [{ index: 0, start: отрезок?.start ?? 0, end: отрезок?.end ?? 0, keyframe: 0, intensity: 0 }];
    // Реклама ляжет туда, где меньше движения: самый спокойный план.
    const спокойный = сцены.reduce((лучший, с) => (с.intensity < лучший.intensity ? с : лучший), сцены[0]);
    const timeline = сцены.map((с, и) => {
      const строки = [`${timecode(с.start)}–${timecode(с.end)}`];
      /*  В английский шаблон идут английские такты: раньше сюда
          попадал русский текст модели.                          */
      const такты = lang === "en" && ответ.actionEn?.length ? ответ.actionEn : ответ.action;
      const такт = beatFor(такты, (с.start + с.end) / 2);
      строки.push(
        `  Cam: ${камера ? (lang === "ru" ? камера.ru : камера.en) : поле("camera") || "static"}`,
      );
      строки.push(`  Act: ${такт || (lang === "ru" ? "продолжение действия" : "action continues")}`);
      if (с === спокойный) {
        строки.push(
          /*  Слово «реклама» уже стоит в стиле рекламного пресета — здесь
              пишем «врезка», чтобы оно не повторялось в одном промпте. */
          lang === "ru"
            ? `  сюда ляжет врезка: ${surfaceWord(source, lang)}, план ${и + 1}`
            : `  ad placement here: ${surfaceWord(source, lang)}, shot ${и + 1}`,
        );
      }
      return строки.join("\n");
    });

    // ── INVARIANT ────────────────────────────────────────────────────
    const общиеСлоты = source.shared?.slots;
    const вИнварианте = общиеСлоты
      ? [общиеСлоты.hero ? SLOT_HERO : "", общиеСлоты.product ? SLOT_PRODUCT : "", общиеСлоты.place ? SLOT_PLACE : ""].filter(Boolean)
      : слоты;
    const invariant: string[] = [];
    for (const слот of вИнварианте) {
      invariant.push(`${слот} keeps its identity in every frame`);
    }
    if (общиеСлоты ? общиеСлоты.product : продуктПоставлен) {
      invariant.push("product surfaces stay blank for a logo");
    }
    invariant.push("no text anywhere in frame");

    return [
      "REFERENCES:",
      references.length ? references.join("\n") : lang === "ru" ? "слоты не нужны: в кадре нечего заменять" : "no reference slots needed",
      "",
      `CORE SCENE: ${ядро || основа}`,
      /*  Предметы, на которых генератор норовит написать текст, идут
          отдельными строками сразу под сценой.                      */
      обереги.join("\n"),
      "",
      "GLOBAL:",
      global.join("\n"),
      `Exclusions: ${запреты.join(", ")}`,
      "",
      "TIMELINE:",
      timeline.join("\n"),
      "",
      "INVARIANT:",
      invariant.join("\n"),
      "",
      source.flags,
    ]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  return { ru: сделать("ru"), en: сделать("en") };
}
