"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/*  ОКНО ВХОДА. Пока пароль не сошёлся, на странице нет ничего, кроме
    этой формы: разбор, кадры и промпты закрыты замком.            */
export function LockForm({ парольЗадан }: { парольЗадан: boolean }) {
  const [пароль, setПароль] = useState("");
  const [беда, setБеда] = useState<string | null>(null);
  const [идём, setИдём] = useState(false);
  const router = useRouter();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">РЕВЕРС</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Видео → промпт → кадры. Сайт закрыт паролем: он один на всех, кого пустили.
        </p>
      </div>

      {!парольЗадан ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          На сервере не задана переменная REVERS_PAROL — сайт закрыт для всех, включая владельца.
        </p>
      ) : null}

      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setИдём(true);
          setБеда(null);
          try {
            const ответ = await fetch("/api/vhod", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ пароль }),
            });
            const данные = (await ответ.json()) as { error?: string };
            if (!ответ.ok) throw new Error(данные.error ?? "Пароль не подошёл");
            router.replace("/");
            router.refresh();
          } catch (e) {
            setБеда(e instanceof Error ? e.message : "Пароль не подошёл");
          } finally {
            setИдём(false);
          }
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm text-neutral-400">
          Пароль
          <input
            type="password"
            autoFocus
            value={пароль}
            onChange={(e) => setПароль(e.target.value)}
            className="h-11 rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-base text-neutral-100 outline-none focus:border-neutral-400"
          />
        </label>
        {беда ? <p className="text-sm text-red-400">{беда}</p> : null}
        <button
          type="submit"
          disabled={идём}
          className="h-11 rounded-lg bg-neutral-100 font-medium text-neutral-900 disabled:opacity-60"
        >
          {идём ? "Проверяем…" : "Войти"}
        </button>
      </form>
    </main>
  );
}
