import { eq } from "drizzle-orm";
import { db } from "@/db";
import { analyses } from "@/db/schema";
import { rowToHistoryItem } from "@/lib/history";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const rows = await db.select().from(analyses).where(eq(analyses.id, id)).limit(1);
    if (!rows.length) {
      return Response.json({ error: "Запись не найдена" }, { status: 404 });
    }
    return Response.json({ item: rowToHistoryItem(rows[0]) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return Response.json({ error: "Ошибка чтения", detail: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const rows = await db.delete(analyses).where(eq(analyses.id, id)).returning({ id: analyses.id });
    if (!rows.length) {
      return Response.json({ error: "Запись не найдена" }, { status: 404 });
    }
    return Response.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return Response.json({ error: "Ошибка удаления", detail: message }, { status: 500 });
  }
}
