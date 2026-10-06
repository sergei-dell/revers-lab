"use client";

import { buildContactSheet, canvasToBlob, drawVideo, makeCanvas, seekVideo } from "@/lib/video/capture";
import type { FrameShot } from "@/lib/types";

/*  КАДРЫ ДЛЯ ПАКЕТА.

    Claude не умеет смотреть видео, поэтому в пакет кладутся картинки:
    раскадровка каждые полсекунды и ключевые кадры — начало, смены
    движения, конец. Снимаем их с готовой видео-основы, а не с
    исходника: интерфейс там уже обрезан, и Claude видит ровно то, что
    увидит Seedance.                                                  */

/** Шаг раскадровки — полсекунды, как в задании. */
const ШАГ_РАСКАДРОВКИ = 0.5;
/** Больше этого числа кадров в лист не кладём: станет нечитаемым. */
const ПРЕДЕЛ_РАСКАДРОВКИ = 48;
/** Ширина картинки, по которой ищем смены движения. */
const ШИРИНА_РАЗБОРА = 96;

export type КадрыДляПакета = {
  раскадровка: Blob;
  ключевые: Array<{ имя: string; время: number; blob: Blob }>;
  /** Секунды, где движение заметно меняется. */
  смены: number[];
};

/** Открыть основу отдельным проигрывателем: исходный плеер не трогаем. */
export function открытьВидео(адрес: string): Promise<HTMLVideoElement> {
  return new Promise((готово, беда) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    /*  Основа отдаётся своим же сервером, так что холст остаётся
        «чистым» и кадры с него читаются.                          */
    video.crossOrigin = "anonymous";
    const снять = () => {
      video.removeEventListener("loadeddata", наГотово);
      video.removeEventListener("error", наБеду);
    };
    const наГотово = () => {
      снять();
      готово(video);
    };
    const наБеду = () => {
      снять();
      беда(new Error("Не удалось открыть видео-основу"));
    };
    video.addEventListener("loadeddata", наГотово);
    video.addEventListener("error", наБеду);
    video.src = адрес;
  });
}

async function снять(
  video: HTMLVideoElement,
  время: number,
  ширина: number,
): Promise<{ blob: Blob; url: string }> {
  await seekVideo(video, время);
  const w = video.videoWidth || 1080;
  const h = video.videoHeight || 1920;
  const ш = Math.min(ширина, w);
  const canvas = makeCanvas(ш, Math.max(1, Math.round((h * ш) / w)));
  drawVideo(video, canvas);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  return { blob, url: URL.createObjectURL(blob) };
}

/*  ГДЕ МЕНЯЕТСЯ ДВИЖЕНИЕ. Сравниваем соседние выборки по яркости: где
    картинка перестраивается заметно сильнее обычного, там смена —
    по таким точкам Claude расставляет якоря в MOTION LOCK.         */
async function сменыДвижения(video: HTMLVideoElement, длительность: number): Promise<number[]> {
  const шаг = 0.1;
  const всего = Math.max(2, Math.floor(длительность / шаг));
  const w = video.videoWidth || 1080;
  const h = video.videoHeight || 1920;
  const ш = ШИРИНА_РАЗБОРА;
  const в = Math.max(8, Math.round((h * ш) / w));
  const canvas = makeCanvas(ш, в);
  const разницы: Array<{ t: number; d: number }> = [];
  let прежний: Uint8ClampedArray | null = null;

  for (let i = 0; i < всего; i += 1) {
    const t = Math.min(длительность - 0.03, i * шаг);
    await seekVideo(video, t);
    const ctx = drawVideo(video, canvas);
    const данные = ctx.getImageData(0, 0, ш, в).data;
    if (прежний) {
      let сумма = 0;
      let n = 0;
      for (let p = 0; p < данные.length; p += 16) {
        сумма += Math.abs(данные[p] - прежний[p]);
        n += 1;
      }
      разницы.push({ t, d: сумма / Math.max(1, n) / 255 });
    }
    прежний = new Uint8ClampedArray(данные);
  }
  if (разницы.length < 3) return [];

  const значения = разницы.map((р) => р.d);
  const среднее = значения.reduce((a, b) => a + b, 0) / значения.length;
  const разброс = Math.sqrt(
    значения.reduce((a, x) => a + (x - среднее) ** 2, 0) / Math.max(1, значения.length - 1),
  );
  const порог = среднее + 1.6 * разброс;

  const точки: number[] = [];
  for (let i = 1; i < разницы.length - 1; i += 1) {
    const с = разницы[i];
    if (с.d <= порог) continue;
    if (с.d < разницы[i - 1].d || с.d < разницы[i + 1].d) continue;
    /*  Две смены подряд в пределах трети секунды — это одна смена. */
    if (точки.length && с.t - точки[точки.length - 1] < 0.35) continue;
    точки.push(Number(с.t.toFixed(2)));
  }
  return точки.slice(0, 20);
}

export async function кадрыДляПакета(
  адрес: string,
  длительность: number,
): Promise<КадрыДляПакета> {
  const video = await открытьВидео(адрес);
  try {
    const длина = длительность || video.duration || 0;
    if (!длина) throw new Error("У основы не читается длительность");

    const смены = await сменыДвижения(video, длина);

    /*  Раскадровка: каждые полсекунды, с таймкодом под каждым кадром. */
    const времена: number[] = [];
    for (let t = 0; t < длина && времена.length < ПРЕДЕЛ_РАСКАДРОВКИ; t += ШАГ_РАСКАДРОВКИ) {
      времена.push(Number(t.toFixed(2)));
    }
    const снимки: FrameShot[] = [];
    for (const t of времена) {
      const { blob, url } = await снять(video, t, 320);
      снимки.push({
        id: `rk-${t}`,
        time: t,
        url,
        blob,
        width: 320,
        height: 0,
        bytes: blob.size,
        format: "image/jpeg",
        source: "auto",
      });
    }
    const раскадровка = await buildContactSheet(снимки, {
      columns: Math.min(8, Math.max(4, Math.ceil(Math.sqrt(снимки.length)))),
      title: "Раскадровка · каждые 0,5 сек",
    });
    for (const с of снимки) URL.revokeObjectURL(с.url);

    /*  Ключевые кадры: начало, смены движения и конец — в полном
        размере основы, их Claude разглядывает подробно.            */
    const ключевыеВремена = [0, ...смены, Math.max(0, длина - 0.08)];
    const ключевые: КадрыДляПакета["ключевые"] = [];
    let n = 0;
    for (const t of ключевыеВремена) {
      n += 1;
      const { blob, url } = await снять(video, t, 1080);
      URL.revokeObjectURL(url);
      const метка = t.toFixed(2).replace(".", "-");
      ключевые.push({ имя: `кадр-${String(n).padStart(2, "0")}_${метка}s.jpg`, время: t, blob });
    }

    return { раскадровка, ключевые, смены };
  } finally {
    video.removeAttribute("src");
    video.load();
  }
}
