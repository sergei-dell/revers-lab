import {
  включена,
  значение,
  номераКартинок,
  type Подмена,
} from "@/lib/osnova/подмены";

/*  ШАБЛОН «ПОВЕРХ ОРИГИНАЛА», СОБРАННЫЙ КОДОМ.

    Это заготовка: её же мы кладём в пакет для Claude и ею же можно
    работать совсем без Claude. Формат — тип А из «ПРОЧТИ-claude.md»,
    проверенный на турнике.

    Главное правило этого текста — писать «замки», а не описание сцены.
    Движение, камера и тайминг уже заданы видео-основой; слова нужны
    только чтобы модель их не трогала.                               */

export type Момент = {
  /** Время от начала ролика, сек. */
  время: number;
  /** Что происходит — по-английски, короткой фразой. */
  что: string;
  /** Это и есть фишка: такой момент пропускать нельзя. */
  фишка?: boolean;
};

export type ДанныеШаблона = {
  фишка: string;
  /** Что в кадре нельзя менять: форма и место. */
  замок: string;
  моменты: Момент[];
  подмены: Подмена[];
  /** Записанные баги прошлых генераций — каждый станет правилом. */
  баги?: string[];
};

export function времяМетки(сек: number): string {
  const целые = Math.max(0, Math.floor(сек));
  const доли = Math.round((Math.max(0, сек) % 1) * 10);
  return `00:${String(целые).padStart(2, "0")}.${доли}`;
}

export function собратьШаблон(данные: ДанныеШаблона): string {
  const { подмены, моменты } = данные;
  const номера = номераКартинок(подмены);
  const есть = (к: Parameters<typeof включена>[1]) => включена(подмены, к);
  const замок = данные.замок.trim() || "the main object";
  const фишка = данные.фишка.trim();
  const баги = (данные.баги ?? []).map((б) => б.trim()).filter(Boolean);
  const строки: string[] = [];

  строки.push("CREATIVE MAPPING");
  строки.push(
    `@video1 = base video and authoritative reference for every movement, timing, camera position, handheld shake, framing, ${замок}, performer scale, frame order, audio and duration.`,
  );
  if (есть("face")) {
    строки.push(
      `@image${номера.face} = lead performer's facial identity only. No background, lighting or pose transfer.`,
    );
  }
  if (есть("body")) {
    строки.push(
      `@image${номера.body} = lead performer's body build and hair only. Ignore the clothing in it.`,
    );
  }
  if (есть("loc")) {
    строки.push(
      `@image${номера.loc} = environment only. Do not take people or objects from it.`,
    );
  }
  if (есть("prod")) {
    строки.push(
      `@image${номера.prod} = the exact object that replaces ${значение(подмены, "prod") || "the original object"}: shape, proportions, materials, colour. No printed text.`,
    );
  }

  строки.push("", "ONE-SENTENCE SUMMARY");
  строки.push(
    `Edit the existing @video1 performance: ${фишка || "[в чём фишка — впишите одной строкой]"} — only the person${
      есть("loc") ? ", the surroundings" : ""
    }${есть("prod") ? " and the object" : ""} change; motion, camera and timing stay exactly as in the source.`,
  );

  строки.push("", "MOTION LOCK — ABSOLUTE");
  const первый = моменты[0];
  if (первый) {
    строки.push(
      `Frame 1 of the output equals frame 1 of @video1, pose for pose: ${первый.что}. No intro, no delay, no extra beats.`,
    );
  }
  строки.push("Preserve every movement at its exact source time:");
  for (const м of моменты) {
    строки.push(
      `  ${времяМетки(м.время)} — ${м.что}${м.фишка ? "  ← THE GAG, cannot be skipped" : ""}`,
    );
  }
  строки.push(
    "Same joint positions, grips, foot contacts, head angles, speed and momentum. Do not simplify, smooth or add movement.",
  );

  строки.push("", "CAMERA LOCK");
  строки.push(
    "Preserve the source camera exactly: same position, height, shake, framing and motion blur. No new angles, reframing, zoom, stabilisation or slow motion. Same source video texture — not cinematic.",
  );

  строки.push("", "OBJECT LOCK — EVERY FRAME");
  строки.push(
    `${замок} stays in every frame with identical shape, size and position. Body and hands never pass through it.`,
  );

  if (есть("face") || есть("body") || есть("outfit")) {
    строки.push("", "PERFORMER");
    строки.push(
      "REPLACE COMPLETELY: no trace of the original performer — hair, body shape and clothes.",
    );
    if (есть("face")) {
      строки.push(
        `FACE: apply @image${номера.face} identity to the visible face only; keep source expressions. Hidden or upside-down face stays hidden.`,
      );
    }
    if (есть("body")) {
      строки.push(
        `HAIR AND BODY: hair and build exactly as in @image${номера.body}, even upside down and in fast motion.`,
      );
    }
    if (есть("outfit")) {
      строки.push(
        `OUTFIT: ${значение(подмены, "outfit") || "[одежда — впишите по-английски]"}. Same outfit in every frame; nothing else. Never the clothing from the performer photos.`,
      );
    }
  }

  if (есть("loc")) {
    строки.push("", "LOCATION");
    строки.push(
      `Replace everything around ${замок} with @image${номера.loc}, matched to the source perspective, horizon and light. Nothing covers the performer, hands or feet.`,
    );
  }

  if (есть("prod")) {
    const вехи = моменты
      .filter((м) => м.фишка)
      .map((м) => времяМетки(м.время))
      .join(", ");
    строки.push("", "PRODUCT");
    строки.push(
      `@image${номера.prod} replaces ${значение(подмены, "prod") || "the original object"} in every frame where it is visible in the source, following its exact path${
        вехи ? ` (key moments ${вехи})` : ""
      }. At the calmest moment at the end it is clearly visible and sharp. Same object, size and colour in every frame.`,
    );
  }

  строки.push("", "AUDIO");
  строки.push("Preserve the original audio of @video1 in exact sync. Nothing added.");

  /*  Баги прошлой генерации — отдельными правилами: модель повторяет
      одну и ту же ошибку, пока ей прямо не запретишь.               */
  if (баги.length) {
    строки.push("", "FIX FROM PREVIOUS ATTEMPT");
    for (const б of баги) строки.push(`- ${б} — must not happen again.`);
  }

  строки.push("", "NEGATIVES");
  const запреты = [
    "No altered motion",
    "no retiming",
    "no cuts",
    "no reframing",
    "no stabilisation",
    "no slow motion",
    "no extra or missing people",
    "no duplicated limbs",
    "no morphing face",
    "no trace of the original performer",
  ];
  if (есть("outfit")) запреты.push("no clothing other than specified");
  for (const б of баги) запреты.push(`no ${б}`);
  запреты.push("no text", "no logos", "no watermarks", "no UI elements");
  строки.push(`${запреты.join(", ")}.`);

  return строки.join("\n");
}
