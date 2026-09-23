// ЗАМОК НА САЙТ.
//
// Сайт открывается только по паролю из переменной окружения REVERS_PAROL.
// Пароль нигде не хранится: в браузере остаётся лишь подпись, посчитанная
// от него, — подделать её, не зная пароля, нельзя.
//
// Зачем: у сервиса один ключ Pollinations на всех, и посторонние тратили
// бы его молча.

export const ИМЯ_БИЛЕТА = "revers-vhod";
export const СРОК_БИЛЕТА = 60 * 60 * 24 * 30;
const ПОДПИСЫВАЕМ = "вход в реверс";

/** Подпись билета. Одинаково считается и на сервере, и в мидлваре. */
export async function подписьБилета(пароль: string): Promise<string> {
  const ключ = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(пароль),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const подпись = await crypto.subtle.sign("HMAC", ключ, new TextEncoder().encode(ПОДПИСЫВАЕМ));
  return [...new Uint8Array(подпись)].map((б) => б.toString(16).padStart(2, "0")).join("");
}

/** Сравнение без подсказок по времени. */
export function совпадает(а: string, б: string): boolean {
  if (а.length !== б.length) return false;
  let разница = 0;
  for (let i = 0; i < а.length; i += 1) разница |= а.charCodeAt(i) ^ б.charCodeAt(i);
  return разница === 0;
}

export function пароль(): string | null {
  const значение = process.env.REVERS_PAROL?.trim();
  return значение ? значение : null;
}
