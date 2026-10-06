import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { ffmpegЕсть } from "@/lib/osnova/ffmpeg";
import { папкаРазбора, ровныйId } from "@/lib/osnova/папка";
import { проверки, пересобрать, разобратьРолик, читатьРазбор } from "@/lib/osnova/основа";

/*  ВИДЕО-ОСНОВА: приём ролика и пересборка по правленой рамке.

    Работа идёт на сервере: ffmpeg живёт там, да и 1080×1920 с высоким
    битрейтом в браузере не собрать.                                 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/*  Пересборка двух основ занимает секунды, но на медленной машине
    может и затянуться — даём запас.                                */
export const maxDuration = 300;

const ПРЕДЕЛ = 300 * 1024 * 1024;
const ИСХОДНИК = "исходник";

function ответОшибки(текст: string, код = 400) {
  return Response.json({ error: текст }, { status: код });
}

export async function POST(request: Request) {
  if (!ffmpegЕсть()) {
    return ответОшибки("ffmpeg не установлен — выполните npm install в папке сервиса", 503);
  }

  const форма = await request.formData().catch(() => null);
  if (!форма) return ответОшибки("Ожидалась форма с файлом");

  const файл = форма.get("файл");
  if (!(файл instanceof File)) return ответОшибки("Не пришёл файл ролика");
  if (!файл.size) return ответОшибки("Файл пустой");
  if (файл.size > ПРЕДЕЛ) return ответОшибки("Ролик больше 300 МБ");

  const id = randomUUID();
  const папка = await папкаРазбора(id);
  /*  Расширение держим: ffmpeg по нему быстрее понимает контейнер. */
  const расширение = (файл.name.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5);
  const исходный = path.join(папка, `${ИСХОДНИК}.${расширение || "mp4"}`);
  await writeFile(исходный, Buffer.from(await файл.arrayBuffer()));

  try {
    const разбор = await разобратьРолик(id, исходный, файл.name);
    return Response.json({ разбор, проверки: проверки(разбор) });
  } catch (беда) {
    return ответОшибки(
      беда instanceof Error ? беда.message : "Не удалось разобрать ролик",
      500,
    );
  }
}

/*  Рамку поправили руками — пересобираем обе основы по ней.        */
export async function PATCH(request: Request) {
  const тело = (await request.json().catch(() => null)) as
    | { id?: string; рамка?: { x: number; y: number; w: number; h: number } }
    | null;
  const id = ровныйId(String(тело?.id ?? ""));
  if (!id) return ответОшибки("Не указан разбор");

  const прежний = await читатьРазбор(id);
  if (!прежний) return ответОшибки("Разбор не найден — загрузите ролик заново", 404);

  const р = тело?.рамка;
  if (!р) return ответОшибки("Не пришла рамка");

  /*  Рамку, пришедшую снаружи, прижимаем к кадру: ffmpeg на выходе за
      границы просто падает.                                         */
  const { ширина, высота } = прежний.исходник;
  const чётко = (v: number) => Math.max(0, Math.round(v / 2) * 2);
  const x = Math.min(чётко(р.x), ширина - 2);
  const y = Math.min(чётко(р.y), высота - 2);
  const w = Math.max(2, Math.min(чётко(р.w), ширина - x));
  const h = Math.max(2, Math.min(чётко(р.h), высота - y));

  const папка = await папкаРазбора(id);
  const исходный = path.join(папка, `${ИСХОДНИК}.${(prevExt(прежний.имя) || "mp4")}`);

  try {
    const разбор = await пересобрать(
      id,
      исходный,
      прежний.имя,
      прежний.исходник,
      { x, y, w, h },
      true,
    );
    return Response.json({ разбор, проверки: проверки(разбор) });
  } catch (беда) {
    return ответОшибки(
      беда instanceof Error ? беда.message : "Не удалось пересобрать основу",
      500,
    );
  }
}

function prevExt(имя: string): string {
  return (имя.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5);
}

export async function GET(request: Request) {
  const id = ровныйId(new URL(request.url).searchParams.get("id") ?? "");
  if (!id) return ответОшибки("Не указан разбор");
  const разбор = await читатьРазбор(id);
  if (!разбор) return ответОшибки("Разбор не найден", 404);
  return Response.json({ разбор, проверки: проверки(разбор) });
}
