// Сколько кадров можно отправить модели на описание. Общий список для
// браузера и сервера: панель показывает эти варианты, маршрут других не
// принимает.
// 10 — потолок модели по умолчанию openai/gpt-5.4-mini: на ней это
// значение доступно, дальше начинается проверка предела.
export const ENRICH_FRAME_OPTIONS = [6, 8, 10, 12, 16] as const;
export type EnrichFrameCount = (typeof ENRICH_FRAME_OPTIONS)[number];
export const DEFAULT_ENRICH_FRAMES: EnrichFrameCount = 8;

export function isFrameCount(value: unknown): value is EnrichFrameCount {
  return ENRICH_FRAME_OPTIONS.includes(Number(value) as EnrichFrameCount);
}

// Что сервер знает о пределе картинок у выбранной модели.
export type FrameLimitInfo = {
  model: string;
  frames: number;
  /** сколько картинок модель принимает за раз; null — узнать не удалось */
  maxImages: number | null;
  /** влезает ли выбранное число; null — предел неизвестен */
  fits: boolean | null;
  suggestion: { name: string; title: string; maxImages: number } | null;
  /** понятный человеку текст, когда не влезает */
  message: string | null;
};
