"use client";

import { buildContactSheet, loadImage, makeCanvas, canvasToBlob } from "@/lib/video/capture";
import type { FrameShot } from "@/lib/types";

/*  КАДРЫ ДЛЯ ПАКЕТА.

    Claude не умеет смотреть видео, поэтому в пакет кладутся картинки:
    раскадровка каждые полсекунды и ключевые кадры — начало, каждая
    склейка, конец.

    Снимает их сервер через ffmpeg. Раньше это делал браузер перемоткой
    `<video>`: на коротком mp4 выходило, а на настоящем ролике на 35
    секунд все кадры оказывались одним и тем же первым кадром. Браузер
    тут только складывает лист и подписывает времена.                */

export type КадрПакета = {
  имя: string;
  время: number;
  blob: Blob;
};

export type КадрыДляПакета = {
  раскадровка: Blob;
  ключевые: КадрПакета[];
  /** Времена склеек, найденные ffmpeg. */
  смены: number[];
  /** Сцены между склейками — уходят в днк.json. */
  сцены: Array<{ n: number; from: number; to: number; секунд: number }>;
};

type ОтветСервера = {
  раскадровка: Array<{ файл: string; время: number }>;
  ключевые: Array<{ файл: string; время: number }>;
  склейки: number[];
  сцены: Array<{ n: number; from: number; to: number; секунд: number }>;
  длительность: number;
  шаг: number;
  error?: string;
};

function адрес(id: string, файл: string): string {
  return `/api/osnova/${id}/${файл.split("/").map(encodeURIComponent).join("/")}`;
}

/*  Лист раскадровки складываем в браузере: так под каждым кадром
    остаётся его время, а серверу не нужен шрифт для подписей.      */
async function сложитьЛист(кадры: Array<{ blob: Blob; время: number }>): Promise<Blob> {
  if (!кадры.length) {
    /*  Пустой лист всё равно должен быть картинкой: пакет без него
        выглядел бы как сбой.                                       */
    const холст = makeCanvas(640, 120);
    const ctx = холст.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0b0b10";
      ctx.fillRect(0, 0, 640, 120);
      ctx.fillStyle = "#f4f1ea";
      ctx.font = "500 20px sans-serif";
      ctx.fillText("Кадры не снялись", 20, 64);
    }
    return canvasToBlob(холст, "image/jpeg", 0.9);
  }

  const снимки: FrameShot[] = [];
  const ссылки: string[] = [];
  try {
    for (const к of кадры) {
      const url = URL.createObjectURL(к.blob);
      ссылки.push(url);
      const img = await loadImage(url);
      снимки.push({
        id: `rk-${к.время}`,
        time: к.время,
        url,
        blob: к.blob,
        width: img.width,
        height: img.height,
        bytes: к.blob.size,
        format: "image/jpeg",
        source: "auto",
      });
    }
    /*  Колонок берём по корню из числа кадров: у ролика на полминуты
        это шесть-восемь столбцов, лист остаётся читаемым.          */
    const колонок = Math.min(10, Math.max(4, Math.round(Math.sqrt(снимки.length * 1.6))));
    return await buildContactSheet(снимки, {
      columns: колонок,
      title: "Раскадровка · каждые 0,5 сек",
    });
  } finally {
    for (const url of ссылки) URL.revokeObjectURL(url);
  }
}

export async function кадрыДляПакета(id: string): Promise<КадрыДляПакета> {
  const ответ = await fetch("/api/osnova/kadry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const данные = (await ответ.json()) as ОтветСервера;
  if (!ответ.ok) throw new Error(данные.error ?? `Сервер ответил ${ответ.status}`);

  const листКадры: Array<{ blob: Blob; время: number }> = [];
  for (const к of данные.раскадровка) {
    const о = await fetch(адрес(id, к.файл));
    if (о.ok) листКадры.push({ blob: await о.blob(), время: к.время });
  }

  const ключевые: КадрПакета[] = [];
  for (const к of данные.ключевые) {
    const о = await fetch(адрес(id, к.файл));
    if (!о.ok) continue;
    ключевые.push({
      имя: к.файл.split("/").pop() ?? "кадр.jpg",
      время: к.время,
      blob: await о.blob(),
    });
  }

  return {
    раскадровка: await сложитьЛист(листКадры),
    ключевые,
    смены: данные.склейки ?? [],
    сцены: данные.сцены ?? [],
  };
}
