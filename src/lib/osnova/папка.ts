import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/*  ПАПКА ДАННЫХ РЕВЕРСА.

    Postgres у владельца не запущен, да и ради счётчика испытаний база
    не нужна. Всё, что должно пережить перезапуск сервера, лежит
    обычными файлами рядом с проектом: видео-основы и один json.     */

const КОРЕНЬ = path.join(process.cwd(), ".данные");

export function папкаОснов(): string {
  return path.join(КОРЕНЬ, "основы");
}

export async function приготовитьПапку(куда: string): Promise<string> {
  await mkdir(куда, { recursive: true });
  return куда;
}

/*  Имя папки одного разбора. Снаружи приходит id, которому верить
    нельзя: оставляем только буквы, цифры и дефис, чтобы никто не
    вышел запросом за пределы папки данных.                         */
export function ровныйId(значение: string): string {
  return String(значение).replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
}

export async function папкаРазбора(id: string): Promise<string> {
  const чистый = ровныйId(id);
  if (!чистый) throw new Error("Пустой номер разбора");
  return приготовитьПапку(path.join(папкаОснов(), чистый));
}

/* ------------------------------------------------------------------ */

/*  ИСПЫТАНИЕ: ДЕСЯТЬ ТРЕНДОВ.

    Считаем, сколько разных трендов получили «Отлично». Здесь же живёт
    история оценок и записанные баги — они нужны следующему пакету для
    Claude.                                                          */
export type ОценкаТренда = "отлично" | "средне" | "плохо";

export type ЗаписьТренда = {
  id: string;
  имя: string;
  оценка: ОценкаТренда | null;
  /** Что не так — по одной строке на попытку, новые в конце. */
  баги: string[];
  когда: string;
};

export type Испытание = {
  всего: number;
  тренды: ЗаписьТренда[];
};

const ФАЙЛ = () => path.join(КОРЕНЬ, "испытание.json");

export async function читатьИспытание(): Promise<Испытание> {
  try {
    const текст = await readFile(ФАЙЛ(), "utf8");
    const данные = JSON.parse(текст) as Испытание;
    if (!Array.isArray(данные.тренды)) throw new Error("не тот вид");
    return данные;
  } catch {
    /*  Файла ещё нет или он испорчен — начинаем с чистого листа, а не
        роняем экран.                                               */
    return { всего: 10, тренды: [] };
  }
}

export async function записатьИспытание(данные: Испытание): Promise<void> {
  await приготовитьПапку(КОРЕНЬ);
  await writeFile(ФАЙЛ(), JSON.stringify(данные, null, 2), "utf8");
}

/** Сколько трендов уже получили «Отлично». */
export function сколькоОтлично(данные: Испытание): number {
  return данные.тренды.filter((т) => т.оценка === "отлично").length;
}

export async function записатьОценку(
  id: string,
  имя: string,
  оценка: ОценкаТренда,
  баг?: string,
): Promise<Испытание> {
  const данные = await читатьИспытание();
  const чистый = ровныйId(id);
  let запись = данные.тренды.find((т) => т.id === чистый);
  if (!запись) {
    запись = { id: чистый, имя, баги: [], оценка: null, когда: new Date().toISOString() };
    данные.тренды.push(запись);
  }
  запись.имя = имя || запись.имя;
  запись.оценка = оценка;
  запись.когда = new Date().toISOString();
  /*  Баг пишем в историю тренда: он пойдёт в следующий пакет для
      Claude — иначе та же ошибка повторится.                      */
  const чистыйБаг = (баг ?? "").trim();
  if (чистыйБаг && !запись.баги.includes(чистыйБаг)) запись.баги.push(чистыйБаг);
  await записатьИспытание(данные);
  return данные;
}

export async function багиТренда(id: string): Promise<string[]> {
  const данные = await читатьИспытание();
  return данные.тренды.find((т) => т.id === ровныйId(id))?.баги ?? [];
}
