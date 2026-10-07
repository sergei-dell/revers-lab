import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { папкаРазбора, ровныйId } from "@/lib/osnova/папка";

/*  ОТДАЧА ФАЙЛОВ РАЗБОРА: видео-основы и снятых кадров.

    Отдаём потоком: основа на 1080×1920 с высоким битрейтом весит
    десятки мегабайт, держать её целиком в памяти незачем.           */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*  Что вообще разрешено просить. Имена складываются нами же, поэтому
    список закрытый: иначе этим адресом можно было бы читать чужие
    файлы на диске.                                                  */
const ОСНОВА = /^основа-\d{3,4}x\d{3,4}\.mp4$/;
const ЛИСТ = /^раскадровка\/k-\d{4}\.jpg$/;
const КЛЮЧЕВОЙ = /^ключевые\/kadr-\d{2}_[\d-]+s\.jpg$/;

const ТИПЫ: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string[] }> },
) {
  const { id, file } = await params;
  const чистыйId = ровныйId(id);
  const имя = (file ?? []).map((к) => decodeURIComponent(к)).join("/");

  const можно = ОСНОВА.test(имя) || ЛИСТ.test(имя) || КЛЮЧЕВОЙ.test(имя);
  /*  Отдельно отсекаем попытки выйти вверх по дереву: даже если
      правило выше однажды ослабнет.                                */
  if (!чистыйId || !можно || имя.includes("..")) {
    return Response.json({ error: "Такого файла нет" }, { status: 404 });
  }

  const папка = await папкаРазбора(чистыйId);
  const полный = path.join(папка, имя);
  if (!полный.startsWith(папка)) {
    return Response.json({ error: "Такого файла нет" }, { status: 404 });
  }

  try {
    const сведения = await stat(полный);
    const поток = Readable.toWeb(createReadStream(полный)) as ReadableStream;
    const тип = ТИПЫ[path.extname(имя).toLowerCase()] ?? "application/octet-stream";
    return new Response(поток, {
      headers: {
        "Content-Type": тип,
        "Content-Length": String(сведения.size),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }
}
