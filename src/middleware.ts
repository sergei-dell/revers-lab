import { NextResponse, type NextRequest } from "next/server";

import { ИМЯ_БИЛЕТА, пароль, подписьБилета, совпадает } from "@/lib/замок";

/*  ПРОПУСКНОЙ ПУНКТ. Ни одна страница и ни один запрос к серверу не
    открываются без билета: сперва страница входа.

    Если пароль на сервере не задан вовсе, сайт закрыт для всех — иначе
    забытая переменная молча открыла бы его посторонним.            */

export async function middleware(request: NextRequest) {
  const путь = request.nextUrl.pathname;
  const свои = путь === "/vhod" || путь.startsWith("/api/vhod");
  if (свои) return NextResponse.next();

  const настоящий = пароль();
  const билет = request.cookies.get(ИМЯ_БИЛЕТА)?.value ?? "";
  const пускать = настоящий ? совпадает(билет, await подписьБилета(настоящий)) : false;
  if (пускать) return NextResponse.next();

  // Запросам к серверу отвечаем коротко, страницам — показываем вход.
  if (путь.startsWith("/api/")) {
    return NextResponse.json({ error: "Сайт закрыт паролем" }, { status: 401 });
  }
  const вход = request.nextUrl.clone();
  вход.pathname = "/vhod";
  вход.search = "";
  return NextResponse.rewrite(вход);
}

export const config = {
  /*  Мимо замка пропускаем только служебные файлы самой страницы —
      без них не показать даже окно входа.                        */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|webmanifest)$).*)"],
};
