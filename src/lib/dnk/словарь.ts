import { CAMERA_LABELS } from "@/lib/video/analyze";
import type { CameraMove } from "@/lib/types";
import type { ВидПерехода, Крупность } from "@/lib/dnk/types";

/*  СЛОВАРЬ ДЛЯ SEEDANCE.

    Текст сцены владелец вставляет в Seedance по-английски, а гены у нас
    по-русски: так их писал и читал человек. Перевод здесь — обычные
    пары слов, без нейросети: что намерили сами, то и переводим.

    Если владелец вписал в ген что-то своё, перевода для этого нет —
    тогда в английский текст уходит его же фраза как есть. Лучше чужое
    слово в английском тексте, чем выдуманный перевод.               */

/*  ДВИЖЕНИЕ КАМЕРЫ. Берём готовые пары из общего разбора: там для
    каждого движения уже есть и русская, и английская подпись, и новое
    движение не придётся вписывать в двух местах.                    */
export const КАМЕРА_RU_EN: Record<string, string> = Object.fromEntries(
  (Object.keys(CAMERA_LABELS) as CameraMove[]).map((ключ) => [
    CAMERA_LABELS[ключ].ru,
    CAMERA_LABELS[ключ].en,
  ]),
);

export function камераПоАнглийски(значение: string): string {
  const чистое = значение.trim();
  return КАМЕРА_RU_EN[чистое] ?? чистое;
}

/*  ПЕРЕХОДЫ — как их называют на монтаже.                           */
export const ПЕРЕХОД_EN: Record<ВидПерехода, string> = {
  "склейка": "hard cut",
  "вспышка": "white flash",
  "взмах камеры": "whip pan",
  "затемнение": "fade to black",
  "наплыв": "cross-dissolve",
};

/*  КРУПНОСТЬ ПЛАНА.                                                 */
export const ПЛАН_EN: Record<Exclude<Крупность, "">, string> = {
  "крупный": "close-up shot",
  "макро": "macro shot",
  "средний": "medium shot",
  "общий": "wide shot",
};

export function планПоАнглийски(значение: Крупность): string {
  return значение ? ПЛАН_EN[значение] : "";
}

/*  СВЕТ И ЦВЕТ. Ген собирается из кусочков через запятую — их и
    переводим по одному. Коды цветов (#1b4f72) оставляем как есть:
    это те же символы на обоих языках.                              */
const СВЕТ_RU_EN: Record<string, string> = {
  "тёмный кадр": "low-key frame",
  "светлый кадр": "high-key frame",
  "средняя яркость": "medium exposure",
  "тёплый свет": "warm light",
  "холодный свет": "cool light",
  "нейтральный свет": "neutral light",
  "сочный цвет": "saturated color",
  "почти обесцвечено": "nearly desaturated",
};

/*  В ген света мы дописываем коды цветов сцены — на экране это
    полезно, а в тексте для генерации это мусор: модель не читает
    «#174c72». Для текста коды убираем, в гене они остаются.       */
const ТОЛЬКО_КОДЫ = /^(#[0-9a-f]{3,8}[\s·,]*)+$/i;

export function безКодовЦвета(значение: string): string {
  return значение
    .split(",")
    .map((к) => к.trim())
    .filter((к) => к && !ТОЛЬКО_КОДЫ.test(к))
    .join(", ");
}

export function светПоАнглийски(значение: string): string {
  const куски = безКодовЦвета(значение)
    .split(",")
    .map((к) => к.trim())
    .filter(Boolean);
  if (!куски.length) return "";
  return куски.map((к) => СВЕТ_RU_EN[к] ?? к).join(", ");
}

/** Первая буква заглавной — английская фраза начинает предложение. */
export function сБольшой(текст: string): string {
  return текст ? текст[0].toUpperCase() + текст.slice(1) : текст;
}
