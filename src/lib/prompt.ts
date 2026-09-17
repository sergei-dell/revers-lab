import { CAMERA_LABELS } from "@/lib/video/analyze";
import { uniqueTags } from "@/lib/format";
import type { Analysis, PromptBundle, VideoMeta } from "@/lib/types";

export type StylePreset = "cinema" | "commercial" | "anime" | "doc" | "vhs" | "seedance" | "none";

export const STYLE_PRESETS: Array<{
  id: StylePreset;
  label: string;
  hint: string;
  ru: string;
  en: string;
}> = [
  {
    id: "cinema",
    label: "Кино",
    hint: "анаморфная оптика, плёночная пластика",
    ru: "кинематографичный кадр, анаморфная оптика, плёночная цветопередача, мягкое боке",
    en: "cinematic still, anamorphic lens, filmic color response, soft bokeh",
  },
  {
    id: "commercial",
    label: "Реклама",
    hint: "глянец, студийный свет",
    ru: "премиальный рекламный ролик, студийный свет, глянцевая чистая картинка",
    en: "high-end commercial spot, studio lighting, glossy pristine image",
  },
  {
    id: "anime",
    label: "Аниме",
    hint: "cel-shading, контуры",
    ru: "аниме-стилистика, cel-shading, чистые контуры, насыщенные плоские цвета",
    en: "anime style, cel shading, clean line art, saturated flat colors",
  },
  {
    id: "doc",
    label: "Документальное",
    hint: "естественный свет, наблюдение",
    ru: "документальная съёмка, естественный свет, наблюдательная камера, живая фактура",
    en: "documentary footage, available light, observational camera, lived-in texture",
  },
  {
    id: "vhs",
    label: "VHS / ретро",
    hint: "трекинг-шум, хроматика",
    ru: "VHS-эстетика 90-х, хроматические аберрации, трекинг-шум, выцветшая плёнка",
    en: "1990s VHS aesthetic, chromatic aberration, tracking noise, faded tape",
  },
  {
    id: "seedance",
    label: "Seedance 2.5",
    hint: "формат Seedance: живая камера и флаги --ar/--duration",
    ru: "видеоролик Seedance 2.5, живая операторская камера, плавное естественное движение, чистая кинематографичная картинка",
    en: "Seedance 2.5 video, live-action handheld-to-smooth camera work, natural motion, clean cinematic image",
  },
  {
    id: "none",
    label: "Без пресета",
    hint: "только измерения",
    ru: "",
    en: "",
  },
];

const NEGATIVE =
  "blurry, out of focus, low resolution, jpeg artifacts, banding, oversharpened, watermark, logo, subtitles, text overlay, distorted anatomy, extra limbs, morphing objects, flickering exposure, frame interpolation ghosting, duplicate frames, static image, noise spikes, color cast";

function pick<T>(value: number, steps: Array<[number, T]>, fallback: T): T {
  for (const [threshold, result] of steps) {
    if (value < threshold) return result;
  }
  return fallback;
}

function lightingPhrase(a: Analysis) {
  const base = pick(
    a.brightness,
    [
      [0.2, { ru: "низкий ключ, глубокие тени, один жёсткий мотивированный источник", en: "low-key lighting, deep shadows, a single hard motivated key" }],
      [0.34, { ru: "приглушённый сумеречный свет, мягкие тени", en: "dim moody light, soft shadows" }],
      [0.55, { ru: "сбалансированный естественный свет", en: "balanced natural light" }],
      [0.72, { ru: "высокий ключ, яркий рассеянный свет", en: "high-key bright diffused light" }],
    ],
    { ru: "пересвеченный высокий ключ, минимум теней", en: "blown-out high key, minimal shadow" },
  );
  const temp = pick(
    a.warmth + 0.5,
    [
      [0.42, { ru: "холодный сине-дневной баланс", en: "cool daylight blue balance" }],
      [0.58, { ru: "нейтральный баланс белого", en: "neutral white balance" }],
    ],
    { ru: "тёплый вольфрамово-золотой баланс", en: "warm tungsten golden balance" },
  );
  return { ru: `${base.ru}, ${temp.ru}`, en: `${base.en}, ${temp.en}` };
}

function gradePhrase(a: Analysis) {
  const sat = pick(
    a.saturation,
    [
      [0.12, { ru: "почти монохром, обесцвеченный grade", en: "near-monochrome desaturated grade" }],
      [0.26, { ru: "сдержанная приглушённая палитра", en: "muted restrained palette" }],
      [0.45, { ru: "сбалансированный цвет", en: "balanced natural color" }],
      [0.62, { ru: "насыщенный сочный цвет", en: "rich saturated color" }],
    ],
    { ru: "экстремально насыщенный, кислотный цвет", en: "hyper-saturated punchy color" },
  );
  const contrast = a.contrast > 0.2
    ? { ru: "высокий контраст, плотные чёрные", en: "high contrast, dense blacks" }
    : a.contrast < 0.12
      ? { ru: "низкий контраст, плоская мягкая картинка", en: "low contrast, flat soft image" }
      : { ru: "умеренный контраст", en: "moderate contrast" };
  return { ru: `${sat.ru}, ${contrast.ru}`, en: `${sat.en}, ${contrast.en}` };
}

function texturePhrase(a: Analysis) {
  const grain = pick(
    a.grain,
    [
      [0.018, { ru: "чистая цифровая картинка без зерна", en: "clean digital image, no grain" }],
      [0.035, { ru: "тонкое плёночное зерно", en: "fine film grain" }],
      [0.06, { ru: "выраженное зерно 35 мм", en: "visible 35mm film grain" }],
    ],
    { ru: "сильное зерно, шумная плёнка", en: "heavy grain, noisy film stock" },
  );
  const detail = pick(
    a.edges,
    [
      [0.05, { ru: "мягкая картинка, малая глубина резкости, кремовое боке", en: "soft image, shallow depth of field, creamy bokeh" }],
      [0.11, { ru: "средняя детализация, умеренная ГРИП", en: "medium detail, moderate depth of field" }],
      [0.19, { ru: "высокая детализация фактур", en: "high texture detail" }],
    ],
    { ru: "очень резкий глубокий фокус, множество мелких деталей", en: "razor sharp deep focus, dense micro-detail" },
  );
  return { ru: `${grain.ru}, ${detail.ru}`, en: `${grain.en}, ${detail.en}` };
}

function motionPhrase(a: Analysis) {
  const speed = pick(
    a.motionMean,
    [
      [0.012, { ru: "почти неподвижный кадр", en: "near-static frame" }],
      [0.035, { ru: "медленное размеренное движение", en: "slow measured movement" }],
      [0.075, { ru: "движение среднего темпа", en: "moderate-paced movement" }],
      [0.14, { ru: "быстрое энергичное движение", en: "fast energetic movement" }],
    ],
    { ru: "очень быстрое хаотичное движение", en: "very fast chaotic movement" },
  );
  const cam = CAMERA_LABELS[a.camera];
  const extra =
    a.flicker > 0.045
      ? { ru: "заметное мерцание экспозиции или пульсирующий свет", en: "noticeable exposure flicker or pulsing light" }
      : a.flicker > 0.025
        ? { ru: "лёгкая нестабильность экспозиции", en: "slight exposure instability" }
        : { ru: "ровная стабильная экспозиция", en: "steady stable exposure" };
  return {
    ru: `${cam.ru}, ${speed.ru}, ${extra.ru}`,
    en: `${cam.en}, ${speed.en}, ${extra.en}`,
  };
}

function moodPhrase(a: Analysis) {
  if (a.brightness < 0.3 && a.saturation < 0.28)
    return { ru: "меланхоличное, нуарное, созерцательное настроение", en: "melancholic noir, contemplative mood" };
  if (a.brightness < 0.34 && a.motionMean > 0.06)
    return { ru: "напряжённое, тревожное, динамичное", en: "tense, uneasy, kinetic" };
  if (a.brightness > 0.6 && a.saturation > 0.4)
    return { ru: "жизнерадостное, энергичное, солнечное", en: "joyful, energetic, sunlit" };
  if (a.warmth > 0.08 && a.brightness > 0.42)
    return { ru: "тёплое ностальгическое, уютное", en: "warm nostalgic, cozy" };
  if (a.warmth < -0.06)
    return { ru: "холодное отстранённое, технологичное", en: "cold detached, technological" };
  if (a.motionMean < 0.015)
    return { ru: "медитативное, застывшее, тихое", en: "meditative, frozen, quiet" };
  return { ru: "нейтрально-повествовательное, спокойное", en: "neutral narrative, calm" };
}

function subjectPhrase(tags: string) {
  const clean = tags.trim().replace(/\s+/g, " ");
  if (!clean)
    return {
      ru: "объект съёмки не указан — добавьте теги, чтобы описать, что в кадре",
      en: "subject unspecified — add tags describing what is on screen",
    };
  const list = uniqueTags(clean);
  return { ru: list.join(", "), en: list.join(", ") };
}

export function durationFlag(durationSec: number, preset: StylePreset): number {
  const seconds = Math.round(durationSec || 5);
  if (preset === "seedance") return Math.max(3, Math.min(12, seconds));
  return Math.max(1, seconds);
}

/*  БЛОК ЗАМЕРОВ для режима «модель + замеры»: то, что модель по кадрам
    не измерит — точные коды палитры, разобранное движение камеры,
    число планов и зерно.                                            */
export function measurementLines(a: Analysis, meta: VideoMeta): { ru: string; en: string } {
  const palette = a.palette.slice(0, 7);
  const paletteRu = palette.map((p) => `${p.nameRu} ${p.hex}`).join(", ") || "нейтральная";
  const paletteEn = palette.map((p) => `${p.name} ${p.hex}`).join(", ") || "neutral";
  const camera = CAMERA_LABELS[a.camera];
  const confidence = Math.round(a.cameraConfidence * 100);
  const cuts =
    a.scenes.length > 1
      ? { ru: `${a.scenes.length} плана, жёсткие склейки`, en: `${a.scenes.length} shots, hard cuts` }
      : { ru: "один непрерывный дубль", en: "one continuous take" };
  const grainRu = a.grain > 0.035 ? `плёночное зерно ${(a.grain * 100).toFixed(1)}%` : `чистая цифра, зерно ${(a.grain * 100).toFixed(1)}%`;
  const grainEn = a.grain > 0.035 ? `film grain ${(a.grain * 100).toFixed(1)}%` : `clean digital, grain ${(a.grain * 100).toFixed(1)}%`;
  const motionRu = `движение ${(a.motionMean * 100).toFixed(1)}%, дрожание ${(a.motionShake * 100).toFixed(1)}%`;
  const motionEn = `motion ${(a.motionMean * 100).toFixed(1)}%, shake ${(a.motionShake * 100).toFixed(1)}%`;
  return {
    ru: [
      `Палитра: ${paletteRu}.`,
      `Камера: ${camera.ru} (${confidence}% уверенности), ${motionRu}.`,
      `Монтаж: ${cuts.ru}.`,
      `Фактура: ${grainRu}, детализация ${(a.edges * 100).toFixed(1)}%.`,
      `Съёмка: ${meta.width}×${meta.height} (${meta.aspect}), ${meta.durationSec.toFixed(1)} с, ${meta.fps} к/с.`,
    ].join("\n"),
    en: [
      `Palette: ${paletteEn}.`,
      `Camera: ${camera.en} (${confidence}% confidence), ${motionEn}.`,
      `Editing: ${cuts.en}.`,
      `Texture: ${grainEn}, detail ${(a.edges * 100).toFixed(1)}%.`,
      `Source: ${meta.width}x${meta.height} (${meta.aspect}), ${meta.durationSec.toFixed(1)}s, ${meta.fps} fps.`,
    ].join("\n"),
  };
}

export function buildPrompt(input: {
  analysis: Analysis;
  meta: VideoMeta;
  tags?: string;
  preset?: StylePreset;
}): PromptBundle {
  const { analysis: a, meta, tags = "", preset = "cinema" } = input;
  const style = STYLE_PRESETS.find((p) => p.id === preset) ?? STYLE_PRESETS[0];
  // Тег, совпадающий с названием пресета, уже сказан в описании стиля.
  const subject = subjectPhrase(
    uniqueTags(tags)
      .filter((t) => style.id === "none" || t.toLocaleLowerCase("ru") !== style.label.toLocaleLowerCase("ru"))
      .join(", "),
  );
  const light = lightingPhrase(a);
  const grade = gradePhrase(a);
  const texture = texturePhrase(a);
  const motion = motionPhrase(a);
  const mood = moodPhrase(a);
  const palette = a.palette.slice(0, 5);
  const paletteRu = palette.map((p) => `${p.nameRu} ${p.hex}`).join(", ");
  const paletteEn = palette.map((p) => `${p.name} ${p.hex}`).join(", ");
  const shotWord =
    a.scenes.length > 1
      ? { ru: `${a.scenes.length} отдельных плана с жёсткими склейками`, en: `${a.scenes.length} distinct shots with hard cuts` }
      : { ru: "один непрерывный дубль", en: "one continuous take" };
  const ar = /^\d+(\.\d+)?:\d+$/.test(meta.aspect) ? `--ar ${meta.aspect}` : "--ar 16:9";
  /*  Длительность отдельным флагом нужна всем видеомоделям, поэтому
      флаги идут в любом промпте. У Seedance 2.5 длина ограничена, у
      остальных берётся как есть, целыми секундами.                   */
  const flags = `${ar} --duration ${durationFlag(meta.durationSec, style.id)}`;

  const tech = {
    ru: `${meta.width}×${meta.height} (${meta.aspect}), ${meta.durationSec.toFixed(1)} с, ${meta.fps} к/с`,
    en: `${meta.width}x${meta.height} (${meta.aspect}), ${meta.durationSec.toFixed(1)}s, ${meta.fps} fps`,
  };

  const ruParts = [
    `${style.ru ? `${style.ru}. ` : ""}${subject.ru}.`,
    `Освещение: ${light.ru}.`,
    `Цвет: ${grade.ru}; палитра — ${paletteRu || "нейтральная"}.`,
    `Оптика и фактура: ${texture.ru}.`,
    `Движение: ${motion.ru}.`,
    `Монтаж: ${shotWord.ru}.`,
    `Настроение: ${mood.ru}.`,
    `Технические параметры: ${tech.ru}. ${flags}`,
  ];
  const enParts = [
    `${style.en ? `${style.en}. ` : ""}${subject.en}.`,
    `Lighting: ${light.en}.`,
    `Color: ${grade.en}; palette — ${paletteEn || "neutral"}.`,
    `Lens & texture: ${texture.en}.`,
    `Motion: ${motion.en}.`,
    `Editing: ${shotWord.en}.`,
    `Mood: ${mood.en}.`,
    `Technical: ${tech.en}. ${flags}`,
  ];

  const tagSet = uniqueTags([
    style.id !== "none" ? style.label.toLowerCase() : "",
    CAMERA_LABELS[a.camera].en,
    a.exposure === "low-key" ? "low-key" : a.exposure === "high-key" ? "high-key" : "mid-tone",
    a.saturation < 0.2 ? "desaturated" : a.saturation > 0.55 ? "vivid color" : "natural color",
    a.grain > 0.035 ? "film grain" : "clean",
    a.edges > 0.16 ? "highly detailed" : "soft focus",
    a.motionMean > 0.08 ? "dynamic motion" : "slow motion",
    a.warmth > 0.08 ? "warm tone" : a.warmth < -0.06 ? "cool tone" : "neutral tone",
    ...a.dominantHues.slice(0, 2),
    meta.aspect,
  ]);
  const cleanTags = tagSet.filter((t) => t.length > 1);

  const headline = `${subject.ru.split(",")[0].slice(0, 46) || "Без названия"} · ${CAMERA_LABELS[a.camera].ru}`;

  const structured: Record<string, unknown> = {
    subject: subject.ru === subject.en ? subject.en : { ru: subject.ru, en: subject.en },
    style: style.id,
    format: {
      width: meta.width,
      height: meta.height,
      aspect: meta.aspect,
      duration_sec: Number(meta.durationSec.toFixed(3)),
      fps: meta.fps,
      source_file: meta.fileName,
      flags,
    },
    lighting: {
      key: a.exposure,
      brightness: Number(a.brightness.toFixed(3)),
      contrast: Number(a.contrast.toFixed(3)),
      temperature: a.warmth > 0.06 ? "warm" : a.warmth < -0.05 ? "cool" : "neutral",
      flicker: Number(a.flicker.toFixed(4)),
    },
    color: {
      saturation: Number(a.saturation.toFixed(3)),
      palette: palette.map((p) => ({ hex: p.hex, weight: p.weight, name: p.name })),
      dominant_hues: a.dominantHues,
    },
    camera: {
      move: a.camera,
      description_en: CAMERA_LABELS[a.camera].en,
      description_ru: CAMERA_LABELS[a.camera].ru,
      confidence: Number(a.cameraConfidence.toFixed(2)),
      translation_px: a.cameraVector,
      motion_mean: Number(a.motionMean.toFixed(4)),
      motion_peak: Number(a.motionPeak.toFixed(4)),
      handheld_shake: Number(a.motionShake.toFixed(4)),
    },
    texture: {
      grain: Number(a.grain.toFixed(4)),
      edge_density: Number(a.edges.toFixed(4)),
    },
    editing: {
      shots: a.scenes.length,
      cuts: a.scenes.map((s) => ({ start: s.start, end: s.end, keyframe: s.keyframe })),
    },
    mood: mood.en,
    negative_prompt: NEGATIVE,
  };

  return {
    ru: ruParts.join(" "),
    en: enParts.join(" "),
    negative: NEGATIVE,
    structured,
    headline,
    tags: cleanTags,
  };
}

export type Readout = {
  label: string;
  value: string;
  ratio: number;
  note: string;
  tone: "ember" | "ice" | "flare" | "good" | "bad" | "warn";
};

export function metricReadouts(a: Analysis): Readout[] {
  return [
    {
      label: "Яркость",
      value: `${Math.round(a.brightness * 100)}%`,
      ratio: a.brightness,
      note:
        a.exposure === "low-key"
          ? "низкий ключ · тени доминируют"
          : a.exposure === "high-key"
            ? "высокий ключ · много света"
            : "средняя экспозиция",
      tone: "flare",
    },
    {
      label: "Контраст",
      value: `${Math.round(a.contrast * 100)}%`,
      ratio: Math.min(1, a.contrast * 3.4),
      note: a.contrast > 0.2 ? "плотный, драматичный" : a.contrast < 0.12 ? "плоский, мягкий" : "умеренный",
      tone: "ember",
    },
    {
      label: "Насыщенность",
      value: `${Math.round(a.saturation * 100)}%`,
      ratio: Math.min(1, a.saturation * 1.4),
      note: a.saturation < 0.18 ? "почти монохром" : a.saturation > 0.55 ? "очень сочно" : "естественный цвет",
      tone: "ice",
    },
    {
      label: "Теплота",
      value: `${a.warmth > 0 ? "+" : ""}${Math.round(a.warmth * 100)}`,
      ratio: (a.warmth + 0.4) / 0.8,
      note: a.warmth > 0.08 ? "тёплый баланс" : a.warmth < -0.06 ? "холодный баланс" : "нейтральный баланс",
      tone: "flare",
    },
    {
      label: "Детализация",
      value: `${Math.round(a.edges * 100)}%`,
      ratio: Math.min(1, a.edges * 4),
      note: a.edges > 0.16 ? "резко, глубокий фокус" : a.edges < 0.06 ? "мягко, малая ГРИП" : "средняя резкость",
      tone: "good",
    },
    {
      label: "Зерно / шум",
      value: `${Math.round(a.grain * 1000) / 10}`,
      ratio: Math.min(1, a.grain * 12),
      note: a.grain > 0.05 ? "плёночное зерно" : a.grain > 0.025 ? "лёгкая фактура" : "чистая картинка",
      tone: "ember",
    },
    {
      label: "Движение",
      value: `${Math.round(a.motionMean * 1000) / 10}%`,
      ratio: Math.min(1, a.motionMean * 6),
      note: a.motionMean > 0.09 ? "высокая динамика" : a.motionMean > 0.03 ? "средний темп" : "почти статично",
      tone: "ice",
    },
    {
      label: "Тряска камеры",
      value: `${Math.round(a.motionShake * 1000) / 10}`,
      ratio: Math.min(1, a.motionShake * 8),
      note: a.motionShake > 0.05 ? "ручная камера" : a.motionShake > 0.02 ? "лёгкая нестабильность" : "стабильно / штатив",
      tone: "bad",
    },
    {
      label: "Мерцание",
      value: `${Math.round(a.flicker * 1000) / 10}`,
      ratio: Math.min(1, a.flicker * 12),
      note: a.flicker > 0.045 ? "скачки экспозиции" : a.flicker > 0.025 ? "лёгкая пульсация" : "ровный свет",
      tone: "warn",
    },
  ];
}
