import { cookies } from "next/headers";

import { ИМЯ_БИЛЕТА, СРОК_БИЛЕТА, пароль, подписьБилета, совпадает } from "@/lib/замок";

/*  ВХОД НА САЙТ. Сверяем пароль с переменной окружения и выдаём билет.
    Сам пароль в браузер не уходит — только подпись.                */

export const runtime = "nodejs";

export async function POST(request: Request) {
  const настоящий = пароль();
  if (!настоящий) {
    return Response.json(
      { error: "На сервере не задан REVERS_PAROL — сайт закрыт для всех" },
      { status: 503 },
    );
  }
  const тело = (await request.json().catch(() => null)) as { пароль?: string } | null;
  const пришло = String(тело?.пароль ?? "");
  // Пауза, чтобы пароль было бессмысленно подбирать перебором.
  await new Promise((r) => setTimeout(r, 400));
  if (!совпадает(пришло, настоящий)) {
    return Response.json({ error: "Пароль не подошёл" }, { status: 401 });
  }
  /*  Пометку «только по https» ставим, когда запрос и правда пришёл по
      https: на Vercel это так, а при запуске у себя по http такая
      кука браузером не вернулась бы — и вход не срабатывал бы.   */
  const поHttps =
    request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  const хранилище = await cookies();
  хранилище.set(ИМЯ_БИЛЕТА, await подписьБилета(настоящий), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: СРОК_БИЛЕТА,
    secure: поHttps,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const хранилище = await cookies();
  хранилище.delete(ИМЯ_БИЛЕТА);
  return Response.json({ ok: true });
}
