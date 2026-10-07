import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { всеСклейки, снятьКадр, снятьРяд } from "@/lib/osnova/ffmpeg";
import { папкаРазбора, ровныйId } from "@/lib/osnova/папка";
import { читатьРазбор } from "@/lib/osnova/основа";

/*  РАСКАДРОВКА, КЛЮЧЕВЫЕ КАДРЫ И СКЛЕЙКИ.

    Всё снимается с готовой основы — интерфейс там уже обрезан, и Claude
    видит ровно то, что увидит Seedance. Работу делает ffmpeg: браузер
    на длинном ролике перематывал видео неверно и отдавал один и тот же
    первый кадр на все времена.                                       */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Шаг раскадровки — полсекунды, как в задании. */
const ШАГ = 0.5;
/** Ширина кадра раскадровки: лист и так получается большим. */
const ШИРИНА_ЛИСТА = 320;
/** Ключевые кадры Claude разглядывает подробно — берём крупнее. */
const ШИРИНА_КЛЮЧЕВОГО = 1080;
/** Больше ключевых кадров в пакет не кладём. */
const ПРЕДЕЛ_КЛЮЧЕВЫХ = 16;

const ПАПКА_ЛИСТА = "раскадровка";
const ПАПКА_КЛЮЧЕВЫХ = "ключевые";

export async function POST(request: Request) {
  const тело = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = ровныйId(String(тело?.id ?? ""));
  if (!id) return Response.json({ error: "Не указан разбор" }, { status: 400 });

  const разбор = await читатьРазбор(id);
  if (!разбор) return Response.json({ error: "Разбор не найден" }, { status: 404 });

  const папка = await папкаРазбора(id);
  const основа = path.join(папка, разбор.большая.файл);
  const длительность = разбор.исходник.длительность;

  try {
    /*  Снимаем заново: границы могли поправить, и старые кадры уже от
        другой основы.                                               */
    const листПапка = path.join(папка, ПАПКА_ЛИСТА);
    const ключПапка = path.join(папка, ПАПКА_КЛЮЧЕВЫХ);
    await rm(листПапка, { recursive: true, force: true });
    await rm(ключПапка, { recursive: true, force: true });
    await папкаРазбора(id);
    const { mkdir } = await import("node:fs/promises");
    await mkdir(листПапка, { recursive: true });
    await mkdir(ключПапка, { recursive: true });

    const временаЛиста = await снятьРяд(основа, ШАГ, листПапка, "k-%04d.jpg", ШИРИНА_ЛИСТА);
    const листФайлы = (await readdir(листПапка)).filter((и) => и.endsWith(".jpg")).sort();
    const раскадровка = листФайлы.map((имя, i) => ({
      файл: `${ПАПКА_ЛИСТА}/${имя}`,
      /*  Время берём у самого ffmpeg: «номер × шаг» расходится с
          картинкой на доли секунды.                              */
      время: временаЛиста[i] ?? Number((i * ШАГ).toFixed(2)),
    }));

    /*  Склейки ищем двумя способами сразу: встроенный признак ffmpeg
        плюс свой разбор по цвету — поодиночке каждый пропускает своё. */
    const склейки = await всеСклейки(основа, {
      ширина: разбор.большая.ширина,
      высота: разбор.большая.высота,
      длительность,
      fps: 30,
    });

    /*  Ключевые кадры: начало, каждая склейка и конец. Берём чуть
        после склейки — на самом стыке кадр смазан.                 */
    const времена = [0, ...склейки.map((т) => т + 0.08), Math.max(0, длительность - 0.1)]
      .filter((т) => т >= 0 && т <= длительность)
      .sort((a, b) => a - b)
      .filter((т, i, все) => i === 0 || т - все[i - 1] > 0.2)
      .slice(0, ПРЕДЕЛ_КЛЮЧЕВЫХ);

    const ключевые: Array<{ файл: string; время: number }> = [];
    for (let i = 0; i < времена.length; i += 1) {
      const т = времена[i];
      const имя = `kadr-${String(i + 1).padStart(2, "0")}_${т.toFixed(2).replace(".", "-")}s.jpg`;
      const вышло = await снятьКадр(основа, т, path.join(ключПапка, имя), ШИРИНА_КЛЮЧЕВОГО);
      if (вышло) ключевые.push({ файл: `${ПАПКА_КЛЮЧЕВЫХ}/${имя}`, время: Number(т.toFixed(2)) });
    }

    /*  Сцены — промежутки между склейками. Это и уходит в днк.json:
        раньше там стоял ноль сцен, потому что считать их было некому. */
    const границы = [0, ...склейки, длительность];
    const сцены = [];
    for (let i = 0; i < границы.length - 1; i += 1) {
      const начало = границы[i];
      const конец = границы[i + 1];
      if (конец - начало < 0.2) continue;
      сцены.push({
        n: сцены.length + 1,
        from: Number(начало.toFixed(3)),
        to: Number(конец.toFixed(3)),
        секунд: Number((конец - начало).toFixed(2)),
      });
    }

    return Response.json({
      раскадровка,
      ключевые,
      склейки,
      сцены,
      длительность,
      шаг: ШАГ,
    });
  } catch (беда) {
    return Response.json(
      { error: беда instanceof Error ? беда.message : "Не удалось снять кадры" },
      { status: 500 },
    );
  }
}
