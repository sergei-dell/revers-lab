import type { FrameLimitInfo } from "@/lib/enrichOptions";

// СПИСОК МОДЕЛЕЙ POLLINATIONS: сколько картинок каждая принимает за раз.
// Берётся с GET /models (ключ не нужен) и держится в памяти сервера час —
// список меняется редко, а спрашивать его на каждое нажатие незачем.

type ModelRecord = {
  name: string;
  title?: string;
  description?: string;
  aliases?: string[];
  input_modalities?: string[];
  output_modalities?: string[];
  supported_endpoints?: string[];
  supported_parameters?: string[];
  max_reference_images?: number | null;
  community?: boolean;
  alpha?: boolean | null;
  is_specialized?: boolean;
  paid_only?: boolean | null;
  pricing?: { promptTextTokens?: string };
};

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; models: ModelRecord[] } | null = null;

async function loadModels(baseUrl: string): Promise<ModelRecord[] | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models;
  try {
    const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return cache?.models ?? null;
    const models = (await res.json()) as ModelRecord[];
    if (!Array.isArray(models)) return cache?.models ?? null;
    cache = { at: Date.now(), models };
    return models;
  } catch {
    return cache?.models ?? null;
  }
}

function findModel(models: ModelRecord[], name: string): ModelRecord | undefined {
  return models.find((m) => m.name === name) ?? models.find((m) => (m.aliases ?? []).includes(name));
}

// Годится для описания кадров: видит картинки, отвечает текстом в формате
// chat completions и умеет строгий JSON.
function canDescribe(m: ModelRecord): boolean {
  return (
    (m.input_modalities ?? []).includes("image") &&
    (m.output_modalities ?? []).includes("text") &&
    (m.supported_endpoints ?? []).includes("/v1/chat/completions") &&
    (m.supported_parameters ?? []).includes("response_format") &&
    !m.community &&
    !m.alpha &&
    !m.is_specialized &&
    !m.paid_only
  );
}

// Кого предложить, когда текущая модель не тянет: из подходящих убираем
// экспериментальные и заточенные под код, выше ставим мультимодальные,
// дальше — дешевле.
function suggest(models: ModelRecord[], minImages: number, exclude: string) {
  const fit = models.filter(
    (m) => m.name !== exclude && canDescribe(m) && (m.max_reference_images ?? 0) >= minImages,
  );
  const plain = fit.filter((m) => !/-exp\b|code/i.test(m.name));
  const pool = plain.length ? plain : fit;
  const visual = (m: ModelRecord) => (/multimodal|vision|visual|image/i.test(m.description ?? "") ? 0 : 1);
  const price = (m: ModelRecord) => Number(m.pricing?.promptTextTokens ?? Infinity);
  pool.sort((a, b) => visual(a) - visual(b) || price(a) - price(b));
  const best = pool[0];
  return best ? { name: best.name, title: best.title ?? best.name, maxImages: best.max_reference_images ?? minImages } : null;
}

export async function frameLimit(baseUrl: string, model: string, frames: number): Promise<FrameLimitInfo> {
  const models = await loadModels(baseUrl);
  const record = models ? findModel(models, model) : undefined;
  const maxImages = record?.max_reference_images ?? null;
  const fits = maxImages === null ? null : frames <= maxImages;
  const suggestion = fits === false && models ? suggest(models, frames, record?.name ?? model) : null;
  let message: string | null = null;
  if (fits === false) {
    message =
      `Модель ${model} принимает не больше ${maxImages} картинок за раз, а выбрано ${frames}. ` +
      `Выберите меньше кадров` +
      (suggestion
        ? ` или впишите в .env.local строку POLLINATIONS_MODEL=${suggestion.name} — модель «${suggestion.title}» принимает до ${suggestion.maxImages} картинок — и перезапустите сервер.`
        : ".");
  }
  return { model, frames, maxImages, fits, suggestion, message };
}
