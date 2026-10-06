import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { папкаРазбора, ровныйId } from "@/lib/osnova/папка";

/*  ОТДАЧА ВИДЕО-ОСНОВЫ.

    Готовые основы лежат в папке данных рядом с проектом. Отдаём их
    потоком: файл на 1080×1920 с высоким битрейтом весит десятки
    мегабайт, и держать его целиком в памяти незачем.               */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*  Имя файла приходит из адреса — берём только то, что сами же и
    положили, иначе этим адресом можно было бы читать чужие файлы.  */
const РАЗРЕШЕНО = /^основа-\d{3,4}x\d{3,4}\.mp4$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; file: string }> },
) {
  const { id, file } = await params;
  const чистыйId = ровныйId(id);
  const имя = decodeURIComponent(file);
  if (!чистыйId || !РАЗРЕШЕНО.test(имя)) {
    return Response.json({ error: "Такого файла нет" }, { status: 404 });
  }

  const полный = path.join(await папкаРазбора(чистыйId), имя);
  try {
    const сведения = await stat(полный);
    const поток = Readable.toWeb(createReadStream(полный)) as ReadableStream;
    return new Response(поток, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(сведения.size),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(имя)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }
}
