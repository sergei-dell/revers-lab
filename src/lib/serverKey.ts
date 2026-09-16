import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Чтение серверного ключа из окружения — с запасным путём прямо из файла.
//
// Зачем не хватает process.env: Next.js грузит .env.local через dotenv и
// ПОДСТАВЛЯЕТ переменные. Знак $ в значении для него — начало имени другой
// переменной, и всё после $ подставляется пустотой. Ключ «pk-4f$Ab7…» из 35
// знаков превращается в «pk-4f», а ключ, начинающийся с $, — в пустую строку,
// и маршрут честно отвечает «ключа нет». Комментарий после пробела (#) режет
// значение так же. Поэтому значение читается ещё и из самого файла, как есть.
//
// Наружу отсюда уходит только сам ключ и разбор причины БЕЗ значения.

const FILES = [".env.local", ".env.development.local", ".env"];

export type KeyLookup = {
  key: string | null;
  /** откуда взято: переменная окружения или файл */
  source: "env" | "file" | null;
  /** что именно случилось — в журнал сервера, без значения ключа */
  reason: string;
};

export function readServerKey(name: string): KeyLookup {
  const fromEnv = (process.env[name] ?? "").trim();
  const file = findInFiles(name);
  const notes: string[] = [];

  const envValue = normalize(fromEnv);
  const fileValue = file.value ? normalize(file.value) : "";

  if (file.path) notes.push(`файл ${file.path}: строка с ${name} ${file.found ? "есть" : "не найдена"}`);
  else notes.push(`файл .env.local рядом с проектом не найден (папка запуска ${process.cwd()})`);
  if (file.bom) notes.push("в начале файла невидимый знак BOM — из-за него имя первой переменной не читается");
  if (file.similar.length) notes.push(`похожие имена в файле: ${file.similar.join(", ")}`);

  // Значение из окружения короче, чем в файле — его обрезала подстановка.
  if (fileValue && envValue && fileValue !== envValue) {
    notes.push(
      envValue.length < fileValue.length
        ? `значение из окружения короче файла (${envValue.length} против ${fileValue.length}) — подстановка $ или комментарий # съели хвост; беру значение из файла`
        : "значение окружения и файла различаются; беру значение из файла",
    );
    return { key: fileValue, source: "file", reason: notes.join("; ") };
  }
  if (!envValue && fileValue) {
    notes.push(`в окружении ${name} пуст, в файле значение есть (${fileValue.length} знаков) — беру из файла`);
    return { key: fileValue, source: "file", reason: notes.join("; ") };
  }
  if (envValue) {
    notes.push(`значение взято из окружения (${envValue.length} знаков)`);
    return { key: envValue, source: "env", reason: notes.join("; ") };
  }
  notes.push(`${name} не найден ни в окружении, ни в файлах ${FILES.join(", ")}`);
  return { key: null, source: null, reason: notes.join("; ") };
}

// Ключи бывают разные: с кавычками из редактора, с приписанным Bearer,
// с пробелом или переносом строки в конце. Всё это снимается.
function normalize(value: string): string {
  let v = value.replace(/^\uFEFF/, "").trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  v = v.replace(/^Bearer\s+/i, "").trim();
  return v.replace(/[\r\n]+$/, "").trim();
}

type FileHit = { path: string | null; found: boolean; value: string; bom: boolean; similar: string[] };

function findInFiles(name: string): FileHit {
  const root = process.cwd();
  for (const file of FILES) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    let raw = "";
    try {
      raw = readFileSync(path, "utf8");
    } catch {
      return { path, found: false, value: "", bom: false, similar: [] };
    }
    const bom = raw.charCodeAt(0) === 0xfeff;
    const lines = raw.replace(/^\uFEFF/, "").split(/\r?\n/);
    const similar: string[] = [];
    for (const line of lines) {
      const clean = line.trim().replace(/^export\s+/, "");
      if (!clean || clean.startsWith("#")) continue;
      const eq = clean.indexOf("=");
      if (eq < 1) continue;
      const key = clean.slice(0, eq).trim();
      if (key === name) {
        return { path, found: true, value: clean.slice(eq + 1), bom, similar };
      }
      // Имя рядом, но не то: опечатка или лишние знаки — это и подскажем.
      if (/poll/i.test(key) && /key/i.test(key)) similar.push(key);
    }
    return { path, found: false, value: "", bom, similar };
  }
  return { path: null, found: false, value: "", bom: false, similar: [] };
}
