// ЗАЩИТА ОТ БУКВ НА ПРЕДМЕТАХ.
//
// Генераторы охотно пишут на всём, что в жизни бывает с надписью: на
// упаковке, банке, этикетке, вывеске, экране, футболке. Буквы выходят
// кривые и чужие — потом такой кадр не показать.
//
// Поэтому, если модель увидела в кадре такой предмет, в промпт уходит
// отдельная строка «plain unmarked <предмет>, no printed text or
// branding», а сами слова держатся в списке запретов.
//
// Ищем по словам в ответе модели: русское описание, английское, предмет,
// окружение, теги и предложенные замены. Границы слова — через \p{L},
// потому что \b кириллицу не видит.

export type LetteringSource = {
  ru?: string;
  en?: string;
  subject?: string;
  environment?: string;
  tags?: string[];
  replacements?: Array<{ from?: string; to?: string } | string>;
};

type Предмет = { предмет: string; слова: string[] };

/*  Каждый предмет — как он назовётся в промпте и по каким словам его
    узнать. Хватает основы: «упаковк» ловит упаковку и упаковки.      */
const ПРЕДМЕТЫ: Предмет[] = [
  {
    предмет: "packaging",
    слова: ["упаковк", "пачк", "коробк", "картонк", "packag", "package", "box", "carton", "wrapper"],
  },
  { предмет: "can", слова: ["банк", "жестянк", "консерв", "soda can", "tin can", "drink can", "beverage can", "jar"] },
  { предмет: "bottle", слова: ["бутыл", "флакон", "bottle", "flask", "vial"] },
  { предмет: "label", слова: ["этикетк", "наклейк", "ярлык", "label", "sticker", "price tag"] },
  {
    предмет: "sign",
    слова: ["вывеск", "табличк", "указател", "плакат", "афиш", "баннер", "sign", "signage", "billboard", "poster", "banner", "placard"],
  },
  {
    предмет: "screen",
    слова: [
      "экран", "монитор", "дисплей", "телевизор", "телефон", "смартфон", "ноутбук", "планшет",
      "screen", "monitor", "display", "tv", "television", "phone", "smartphone", "laptop", "tablet",
    ],
  },
  {
    предмет: "garment",
    слова: [
      "футболк", "майк", "толстовк", "худи", "свитшот", "кепк", "бейсболк", "принт на",
      "t-shirt", "tshirt", "shirt", "hoodie", "sweatshirt", "baseball cap", "jersey", "printed clothing", "logo tee",
    ],
  },
  { предмет: "cup", слова: ["кружк", "чашк", "стакан", "стаканчик", "cup", "mug", "tumbler"] },
  { предмет: "bag", слова: ["пакет", "сумк", "шоппер", "bag", "tote", "pouch", "sachet"] },
  {
    предмет: "book cover",
    слова: ["книг", "журнал", "газет", "обложк", "book", "magazine", "newspaper", "book cover"],
  },
  { предмет: "screen interface", слова: ["интерфейс", "interface", "app ui", "user interface"] },
];

// Постоянные запреты: уходят в Exclusions рядом с негативом модели.
export const ЗАПРЕТЫ_НАДПИСЕЙ = [
  "no printed text",
  "no lettering",
  "no logos",
  "no branding",
  "no labels with text",
  "no watermarks",
  "no subtitles or captions",
];

function собратьТекстОтвета(ответ: LetteringSource): string {
  const замены = (ответ.replacements ?? []).map((з) =>
    typeof з === "string" ? з : `${з.from ?? ""} ${з.to ?? ""}`,
  );
  return [ответ.subject, ответ.environment, ответ.ru, ответ.en, ...(ответ.tags ?? []), ...замены]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Какие «пишущие» предметы модель увидела в кадре. */
export function предметыСНадписями(ответ: LetteringSource | null): string[] {
  if (!ответ) return [];
  const текст = собратьТекстОтвета(ответ);
  if (!текст.trim()) return [];
  const найдено: string[] = [];
  for (const { предмет, слова } of ПРЕДМЕТЫ) {
    const есть = слова.some((слово) => {
      const основа = слово.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(?<!\\p{L})${основа}\\p{L}*`, "u").test(текст);
    });
    if (есть && !найдено.includes(предмет)) найдено.push(предмет);
  }
  // Больше четырёх строк промпт только замусорят.
  return найдено.slice(0, 4);
}

/** Строки-обереги для промпта: по одной на каждый найденный предмет. */
export function строкиБезНадписей(ответ: LetteringSource | null): string[] {
  return предметыСНадписями(ответ).map((предмет) => `plain unmarked ${предмет}, no printed text or branding`);
}
