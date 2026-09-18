// Пересобирает ветку pages из main: то, что лежит на GitHub Pages.
//
// Зачем: статическая версия когда-то была отдельной веткой и отстала от
// рабочей на семь правок. Теперь код один; ветка pages — это та же main,
// из которой убраны серверные куски (без них статическая сборка Next.js не
// собирается вовсе) и подрезан список зависимостей.
//
// Запуск из корня проекта на чистой main:
//     node scripts/собрать-статику.mjs          — собрать и показать
//     node scripts/собрать-статику.mjs --push   — ещё и отправить на GitHub

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const СЕРВЕРНОЕ = [
  "src/app/api",
  "src/db",
  "src/lib/serverKey.ts",
  "src/lib/pollinationsModels.ts",
  "src/lib/history.ts",
  "drizzle.config.json",
];
const УБРАТЬ_ЗАВИСИМОСТИ = ["drizzle-orm", "pg", "dotenv"];
const УБРАТЬ_РАЗРАБОТКУ = ["drizzle-kit", "@types/pg"];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const npm = (...args) => execFileSync("npm", args, { encoding: "utf8", stdio: "inherit" });

if (git("status", "--porcelain")) {
  console.error("В рабочей копии есть несохранённые правки — сначала закоммить их.");
  process.exit(1);
}
const ветка = git("rev-parse", "--abbrev-ref", "HEAD");
if (ветка !== "main") {
  console.error(`Запускать надо на main, сейчас ${ветка}.`);
  process.exit(1);
}
const откуда = git("rev-parse", "--short", "HEAD");

git("checkout", "pages");
try {
  git("checkout", "main", "--", ".");
  // -f потому, что файлы только что пришли из main и уже в индексе
  execFileSync("git", ["rm", "-r", "-q", "-f", "--ignore-unmatch", ...СЕРВЕРНОЕ]);

  const пакет = JSON.parse(readFileSync("package.json", "utf8"));
  for (const имя of УБРАТЬ_ЗАВИСИМОСТИ) delete пакет.dependencies[имя];
  for (const имя of УБРАТЬ_РАЗРАБОТКУ) delete пакет.devDependencies[имя];
  writeFileSync("package.json", `${JSON.stringify(пакет, null, 2)}\n`);
  npm("install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund");

  execFileSync("git", ["add", "-A"]);
  if (git("status", "--porcelain")) {
    git("commit", "-m", `Статическая версия из main ${откуда}`);
    console.log(`Ветка pages пересобрана из main ${откуда}.`);
    if (process.argv.includes("--push")) {
      git("push", "origin", "pages");
      console.log("Отправлено: сборка на GitHub запустится сама.");
    }
  } else {
    console.log("Расхождений с main нет — пересобирать нечего.");
  }
} finally {
  git("checkout", "main");
}
