import {
  багиТренда,
  записатьОценку,
  сколькоОтлично,
  читатьИспытание,
  type ОценкаТренда,
} from "@/lib/osnova/папка";

/*  ИСПЫТАНИЕ: ДЕСЯТЬ ТРЕНДОВ.

    Счёт идёт по трендам, получившим «Отлично». Postgres у владельца не
    поднят, поэтому всё лежит обычным json-файлом в папке данных: ради
    одного счётчика базу не заводим.                                 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ОЦЕНКИ: ОценкаТренда[] = ["отлично", "средне", "плохо"];

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const данные = await читатьИспытание();
  return Response.json({
    готово: сколькоОтлично(данные),
    всего: данные.всего,
    баги: id ? await багиТренда(id) : [],
  });
}

export async function POST(request: Request) {
  const тело = (await request.json().catch(() => null)) as
    | { id?: string; имя?: string; оценка?: string; баг?: string }
    | null;

  const id = String(тело?.id ?? "").trim();
  if (!id) return Response.json({ error: "Не указан тренд" }, { status: 400 });

  const оценка = String(тело?.оценка ?? "") as ОценкаТренда;
  if (!ОЦЕНКИ.includes(оценка)) {
    return Response.json({ error: "Непонятная оценка" }, { status: 400 });
  }

  const данные = await записатьОценку(
    id,
    String(тело?.имя ?? "").slice(0, 120),
    оценка,
    String(тело?.баг ?? "").slice(0, 400),
  );

  return Response.json({
    готово: сколькоОтлично(данные),
    всего: данные.всего,
    баги: await багиТренда(id),
  });
}
