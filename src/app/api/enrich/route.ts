export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Описание сцены по кадрам. Считает не наш код, а vision-модель через
// Pollinations (формат OpenAI chat completions).
//
// Ключ живёт ТОЛЬКО здесь, на сервере: в браузер он не уходит ни в ответе,
// ни в тексте ошибки. Нет ключа — 501 и понятная строка; локальный анализ
// работает сам по себе и от этого маршрута не зависит.

type EnrichRequest = {
  frames?: string[];
  summary?: string;
  metrics?: unknown;
  tags?: string;
};

const BASE_URL = (process.env.POLLINATIONS_BASE_URL ?? "https://gen.pollinations.ai").replace(/\/+$/, "");

// Модель по умолчанию выбрана из GET /models: принимает картинки
// (input_modalities: text+image), умеет /v1/chat/completions и
// response_format, держит до 10 изображений в запросе.
const DEFAULT_MODEL = "openai/gpt-5.4-mini";

const MIN_FRAMES = 6;
const MAX_FRAMES = 8;
const MAX_SUMMARY = 6000;
const MAX_TAGS = 400;
const TIMEOUT_MS = 55_000;

const SYSTEM = `Ты — ассистент обратной генерации видео. По ключевым кадрам (идут по порядку от начала ролика к концу) и по уже измеренным метрикам ты восстанавливаешь описание сцены для видеомоделей вроде Seedance, Veo, Kling, Sora, Runway.

ЗАПРЕТЫ. В ответе не должно быть:
- брендов, торговых марок, логотипов, названий компаний и продуктов;
- франшиз, названий фильмов, игр, сериалов;
- вымышленных персонажей и их имён;
- реальных людей, их имён, псевдонимов и «в стиле такого-то артиста».
Всё это заменяй нейтральными архетипами и описанием внешности («женщина лет тридцати в красном дождевике», «спортивный кроссовер без опознавательных знаков», «супергерой в тёмном плаще без символики»). Каждую такую замену вноси отдельной записью в поле replacements.

ФОРМАТ. Отвечай СТРОГО одним валидным JSON-объектом, без markdown и без пояснений:
{
  "subject": "кто или что в кадре: внешность, одежда, состояние",
  "environment": "где происходит: место, время суток, погода, фон, детали",
  "camera": "план, оптика, высота и движение камеры, монтаж",
  "light": "источники, направление, жёсткость, контраст, тени",
  "color": "цветовая схема, температура, обработка, доминирующие цвета",
  "texture": "фактура, зерно, резкость, материалы, атмосферные частицы",
  "action": [{"t": "0.0-1.5", "beat": "что происходит в этом отрезке"}],
  "sound": "предполагаемый звук: шумы, музыка, речь без слов",
  "style_tags": ["5-10 коротких английских тегов"],
  "negative_prompt": "английский негативный промпт через запятую",
  "replacements": [{"from": "что было бы названием бренда/персонажа/человека", "to": "чем заменено"}],
  "prompt_ru": "готовый промпт на русском, 3-5 предложений",
  "prompt_en": "the same prompt in English"
}
Поле action разбивает ролик на 3-6 отрезков по времени, t — в секундах. Если объект неочевиден, описывай форму, материал и поведение, не выдумывай.`;

export async function POST(request: Request) {
  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI-описание не включено: на сервере не задан POLLINATIONS_API_KEY. Локальный анализ работает как обычно — он измеряет свет, цвет, оптику и движение без внешних вызовов.",
        code: "no_api_key",
      },
      { status: 501 },
    );
  }

  // Ключ уходит в заголовок: там разрешена только латиница. Кириллица или
  // пробел в ключе иначе падали бы невнятной сетевой ошибкой.
  if (!/^[\x21-\x7e]+$/.test(apiKey)) {
    return Response.json(
      {
        error:
          "POLLINATIONS_API_KEY записан неверно: в ключе есть пробелы или не латинские символы. Скопируйте ключ заново с enter.pollinations.ai/keys.",
        code: "bad_key",
      },
      { status: 500 },
    );
  }

  let body: EnrichRequest;
  try {
    body = (await request.json()) as EnrichRequest;
  } catch {
    return Response.json({ error: "Тело запроса должно быть JSON" }, { status: 400 });
  }

  const frames = (body.frames ?? [])
    .filter((f) => typeof f === "string" && f.startsWith("data:image/"))
    .slice(0, MAX_FRAMES);
  if (!frames.length) {
    return Response.json({ error: "Пришлите хотя бы один кадр в формате data URL" }, { status: 400 });
  }

  const model = process.env.POLLINATIONS_MODEL?.trim() || DEFAULT_MODEL;
  const metrics =
    typeof body.metrics === "string"
      ? body.metrics.slice(0, MAX_SUMMARY)
      : body.metrics
        ? JSON.stringify(body.metrics).slice(0, MAX_SUMMARY)
        : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  `Кадров приложено: ${frames.length} (по порядку от начала к концу).`,
                  frames.length < MIN_FRAMES
                    ? "Кадров меньше обычного — опирайся сильнее на метрики."
                    : "",
                  "",
                  "Измеренные метрики и структурный разбор ролика:",
                  (body.summary ?? "").slice(0, MAX_SUMMARY) || "—",
                  "",
                  "Отдельно метрики движка:",
                  metrics || "—",
                  "",
                  `Теги автора: ${(body.tags ?? "").slice(0, MAX_TAGS) || "—"}`,
                ]
                  .filter(Boolean)
                  .join("\n"),
              },
              ...frames.map((f) => ({ type: "image_url", image_url: { url: f } })),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[enrich] Pollinations ответил", response.status, detail.slice(0, 300));
      return Response.json(explainError(response.status, detail), { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseAnswer(raw);
    if (!parsed) {
      return Response.json(
        {
          error: "Модель ответила не по формату — разбор не удался. Попробуйте ещё раз.",
          code: "bad_json",
          detail: raw.slice(0, 300),
        },
        { status: 502 },
      );
    }
    return Response.json({ ...parsed, model, source: "pollinations" });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    // Причина падает в журнал сервера, человеку — короткая строка.
    console.error("[enrich] запрос к Pollinations не удался:", BASE_URL, error);
    return Response.json(
      {
        error: aborted
          ? "Модель не ответила за минуту. Попробуйте ещё раз или возьмите ролик короче."
          : "Не удалось связаться с сервисом описания. Проверьте сеть и попробуйте снова.",
        code: aborted ? "timeout" : "network",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

// Коды Pollinations переводятся в понятный человеку текст. Сам ответ сервиса
// наружу не отдаём: в нём может быть служебное, а подсказку он даёт и так.
function explainError(status: number, raw: string): { error: string; code: string } {
  const message = upstreamMessage(raw);
  if (status === 401 || status === 403) {
    return {
      error:
        "Ключ Pollinations не принят. Проверьте POLLINATIONS_API_KEY на сервере: ключ берётся на enter.pollinations.ai/keys.",
      code: "auth",
    };
  }
  if (status === 402) {
    return {
      error:
        "На счёте Pollinations кончились средства. Пополните баланс ключа — до этого работает только локальный анализ.",
      code: "balance",
    };
  }
  if (status === 422) {
    return {
      error:
        "Сервис отклонил содержимое кадров: описание такого материала он не выдаёт. Локальный анализ ролика при этом остаётся.",
      code: "rejected",
    };
  }
  if (status === 429) {
    return {
      error: "Слишком часто. Подождите полминуты и повторите — на ключе стоит ограничение запросов.",
      code: "rate_limit",
    };
  }
  if (status === 404) {
    return {
      error:
        "Такой модели нет в Pollinations. Проверьте POLLINATIONS_MODEL или уберите его — тогда возьмётся модель по умолчанию.",
      code: "no_model",
    };
  }
  if (status >= 500) {
    return { error: "Сервис описания сейчас недоступен. Попробуйте позже.", code: "upstream" };
  }
  return {
    error: `Сервис описания ответил ошибкой ${status}${message ? `: ${message}` : ""}`,
    code: "http_" + status,
  };
}

function upstreamMessage(raw: string): string {
  try {
    const value = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    const err = value.error;
    const detail =
      typeof err === "string" ? err : err?.message ?? (typeof value.message === "string" ? value.message : "");
    return (detail ?? "").slice(0, 160);
  } catch {
    return "";
  }
}

type Replacement = { from: string; to: string };
type Beat = { t: string; beat: string };

type EnrichAnswer = {
  ru: string;
  en: string;
  tags: string[];
  subject: string;
  environment: string;
  camera: string;
  light: string;
  color: string;
  texture: string;
  action: Beat[];
  sound: string;
  negative: string;
  replacements: Replacement[];
};

function parseAnswer(raw: string): EnrichAnswer | null {
  for (const candidate of jsonCandidates(raw)) {
    try {
      const v = JSON.parse(candidate) as Record<string, unknown>;
      const subject = text(v.subject);
      const ru = text(v.prompt_ru) || composePrompt(v);
      const en = text(v.prompt_en) || composePrompt(v);
      if (!ru && !en && !subject) continue;
      return {
        ru: ru || en,
        en: en || ru,
        tags: list(v.style_tags).slice(0, 12),
        subject,
        environment: text(v.environment),
        camera: text(v.camera),
        light: text(v.light),
        color: text(v.color),
        texture: text(v.texture),
        action: beats(v.action),
        sound: text(v.sound),
        negative: text(v.negative_prompt),
        replacements: replacementList(v.replacements),
      };
    } catch {
      /* пробуем следующий кусок */
    }
  }
  return null;
}

function jsonCandidates(raw: string): string[] {
  const out = [raw.trim()];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) out.push(fenced[1].trim());
  const braces = raw.match(/\{[\s\S]*\}/);
  if (braces?.[0]) out.push(braces[0]);
  return out;
}

// Готового промпта не пришло — собираем его из полей разбора, чтобы человек
// не остался с пустым окном.
function composePrompt(v: Record<string, unknown>): string {
  const parts = [v.subject, v.environment, v.camera, v.light, v.color, v.texture]
    .map((x) => text(x))
    .filter(Boolean);
  return parts.length ? `${parts.join(". ")}.` : "";
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, 4000) : "";
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [];
}

function beats(v: unknown): Beat[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      if (typeof x === "string") return { t: "", beat: x.trim() };
      const o = x as Record<string, unknown>;
      return { t: text(o.t), beat: text(o.beat) };
    })
    .filter((b) => b.beat)
    .slice(0, 8);
}

function replacementList(v: unknown): Replacement[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = x as Record<string, unknown>;
      return { from: text(o.from), to: text(o.to) };
    })
    .filter((z) => z.from && z.to)
    .slice(0, 12);
}
