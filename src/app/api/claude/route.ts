import { readFile } from "node:fs/promises";
import path from "node:path";

/*  CLAUDE ПИШЕТ ШАБЛОН — РЕЖИМ «ПОТОМ: АВТОМАТИЧЕСКИ».

    Тот же пакет, что владелец носит в чат руками, сервер отправляет по
    API: системным текстом — «ПРОЧТИ-claude.md», сообщением — фишка,
    что меняем, ДНК и картинки. Видео Claude не принимает, поэтому
    вместо него идут раскадровка и ключевые кадры.

    Без ключа маршрут честно отвечает, что Claude не подключён: кнопка
    на экране тогда неактивна, и человек работает вручную.           */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const МОДЕЛЬ_ПО_УМОЛЧАНИЮ = "claude-sonnet-5";
/** Больше этого числа картинок не отправляем: запрос станет неподъёмным. */
const ПРЕДЕЛ_КАРТИНОК = 12;

function ключ(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim();
}

function модель(): string {
  return (process.env.REVERS_CLAUDE_MODEL ?? "").trim() || МОДЕЛЬ_ПО_УМОЛЧАНИЮ;
}

/*  Заглушка для проверки пути без обращения к настоящему API:
    включается переменной REVERS_CLAUDE_STUB=1. Имя латиницей — имена
    переменных окружения в оболочке кириллицей не задать.            */
function этоЗаглушка(): boolean {
  return (process.env.REVERS_CLAUDE_STUB ?? "").trim() === "1";
}

/** Есть ли с кем разговаривать — экран спрашивает это при загрузке. */
export async function GET() {
  return Response.json({
    подключён: Boolean(ключ()) || этоЗаглушка(),
    модель: модель(),
    заглушка: этоЗаглушка(),
  });
}

type Тело = {
  фишка?: string;
  чтоМеняем?: string;
  днк?: string;
  заготовка?: string;
  /** Картинки: раскадровка и ключевые кадры, base64 без заголовка. */
  картинки?: Array<{ имя: string; тип: string; данные: string }>;
  /** Доработка: текущий шаблон и что в нём не так. */
  правка?: { шаблон: string; баг: string };
};

export async function POST(request: Request) {
  if (!ключ() && !этоЗаглушка()) {
    return Response.json(
      { error: "Claude не подключён — работайте вручную" },
      { status: 503 },
    );
  }

  const тело = (await request.json().catch(() => null)) as Тело | null;
  if (!тело) return Response.json({ error: "Пустой запрос" }, { status: 400 });

  const задача = await прочти();
  const куски: string[] = [];

  if (тело.правка) {
    /*  Доработка: шаблон уже есть, менять надо точечно — иначе Claude
        перепишет всё заново и потеряет найденное.                  */
    куски.push("Это доработка уже написанного шаблона, а не новый шаблон.");
    куски.push("");
    куски.push("ЧТО НЕ ТАК В РЕЗУЛЬТАТЕ:");
    куски.push(тело.правка.баг);
    куски.push("");
    куски.push("ТЕКУЩИЙ ШАБЛОН:");
    куски.push(тело.правка.шаблон);
    куски.push("");
    куски.push(
      "Исправь шаблон так, чтобы эта ошибка не повторилась: добавь правило в нужный блок и строку в NEGATIVES. Остальное не трогай. В ответе — только готовый шаблон.",
    );
  } else {
    куски.push("Файлы пакета — текстом. Картинки пакета приложены ниже.");
  }

  if (тело.фишка) куски.push("", "=== фишка.txt ===", тело.фишка);
  if (тело.чтоМеняем) куски.push("", "=== что-меняем.json ===", тело.чтоМеняем);
  if (тело.днк) куски.push("", "=== днк.json ===", тело.днк);
  if (тело.заготовка) куски.push("", "=== заготовка-шаблона.txt ===", тело.заготовка);
  if (!тело.правка) {
    куски.push("", "В ответе — только готовый шаблон, без пояснений до и после.");
  }

  const картинки = (тело.картинки ?? []).slice(0, ПРЕДЕЛ_КАРТИНОК);

  if (этоЗаглушка()) {
    /*  Ровно тот же путь, но без обращения наружу: проверяем разбор
        ответа, а не чужой сервер.                                  */
    return Response.json({
      шаблон: `${тело.правка ? тело.правка.шаблон + "\n" : ""}[ЗАГЛУШКА CLAUDE] Ответ не запрашивался: переменная REVERS_CLAUDE_STUB=1.\nФайлов в сообщении: ${куски.length}, картинок: ${картинки.length}, модель: ${модель()}.`,
      модель: модель(),
      заглушка: true,
    });
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const клиент = new Anthropic({ apiKey: ключ() });

    const содержимое: Array<Record<string, unknown>> = [{ type: "text", text: куски.join("\n") }];
    for (const к of картинки) {
      содержимое.push({
        type: "image",
        source: { type: "base64", media_type: к.тип || "image/jpeg", data: к.данные },
      });
    }

    const ответ = await клиент.messages.create({
      model: модель(),
      max_tokens: 4000,
      system: задача,
      messages: [{ role: "user", content: содержимое as never }],
    });

    const текст = ответ.content
      .map((ч) => (ч.type === "text" ? ч.text : ""))
      .join("")
      .trim();
    if (!текст) throw new Error("Claude вернул пустой ответ");

    return Response.json({ шаблон: текст, модель: модель(), заглушка: false });
  } catch (беда) {
    return Response.json(
      { error: беда instanceof Error ? беда.message : "Claude не ответил" },
      { status: 502 },
    );
  }
}

/*  Задача для Claude лежит рядом с проектом и кладётся в пакет как
    есть — тот же текст идёт системным сообщением.                  */
async function прочти(): Promise<string> {
  /*  Сборщику отдельно говорим не тащить весь проект следом за этим
      чтением: путь складывается во время работы, и без подсказки он
      считает зависимостью всю папку.                               */
  const корень = process.cwd();
  for (const где of [
    path.join(корень, "public", "ПРОЧТИ-claude.md"),
    path.join(корень, "ПРОЧТИ-claude.md"),
  ]) {
    try {
      return await readFile(/*turbopackIgnore: true*/ где, "utf8");
    } catch {
      /* ищем дальше */
    }
  }
  return "Напиши один шаблон-промпт для Seedance по приложенному разбору.";
}
