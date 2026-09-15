import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { analyses, type AnalysisInsert } from "@/db/schema";
import { rowToHistoryItem } from "@/lib/history";

export const dynamic = "force-dynamic";

const MAX_TEXT = 24_000;
const MAX_THUMB = 400_000;

function str(value: unknown, fallback = "", max = MAX_TEXT): string {
  if (typeof value !== "string") return fallback;
  return value.slice(0, max);
}

function num(value: unknown, fallback = 0, max = 1e9): number {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(max, n));
}

function int(value: unknown, fallback = 0, max = 1e6): number {
  return Math.round(num(value, fallback, max));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (id) {
      const rows = await db
        .select()
        .from(analyses)
        .where(and(eq(analyses.id, id)))
        .limit(1);
      if (!rows.length) {
        return Response.json({ error: "Запись не найдена" }, { status: 404 });
      }
      return Response.json({ item: rowToHistoryItem(rows[0]) });
    }
    const limit = Math.min(60, Math.max(1, int(url.searchParams.get("limit"), 24, 60)));
    const rows = await db
      .select()
      .from(analyses)
      .orderBy(desc(analyses.createdAt))
      .limit(limit);
    return Response.json({
      items: rows.map(rowToHistoryItem),
      count: rows.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return Response.json(
      { error: "Не удалось прочитать историю", detail: message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: "Тело запроса должно быть JSON" },
      { status: 400 },
    );
  }

  const title = str(body.title).trim();
  const fileName = str(body.fileName, "clip").trim() || "clip";
  if (!title && !fileName) {
    return Response.json({ error: "Укажите название клипа" }, { status: 400 });
  }

  const payload: AnalysisInsert = {
    title: title || fileName,
    fileName,
    source: body.source === "url" ? "url" : "upload",
    durationSec: num(body.durationSec, 0, 100000).toFixed(3),
    width: int(body.width),
    height: int(body.height),
    fps: num(body.fps, 0, 1000).toFixed(2),
    sizeBytes: int(body.sizeBytes, 0, 2_000_000_000),
    subjectTags: str(body.subjectTags, "", 600),
    promptRu: str(body.promptRu),
    promptEn: str(body.promptEn),
    negativePrompt: str(body.negativePrompt, "", 4000),
    structured: (body.structured as Record<string, unknown>) ?? undefined,
    metrics: body.metrics as AnalysisInsert["metrics"],
    palette: Array.isArray(body.palette)
      ? (body.palette as AnalysisInsert["palette"])
      : [],
    scenes: Array.isArray(body.scenes) ? (body.scenes as AnalysisInsert["scenes"]) : [],
    frameCount: int(body.frameCount),
    thumb: str(body.thumb, "", MAX_THUMB) || null,
  };

  try {
    const rows = await db.insert(analyses).values(payload).returning();
    return Response.json({ item: rowToHistoryItem(rows[0]) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return Response.json(
      { error: "Не удалось сохранить анализ", detail: message },
      { status: 500 },
    );
  }
}
