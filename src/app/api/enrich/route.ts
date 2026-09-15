export const dynamic = "force-dynamic";
export const maxDuration = 60;

type EnrichRequest = {
  frames?: string[];
  summary?: string;
  tags?: string;
};

const SYSTEM = `Ты — ассистент обратной генерации видео. По ключевым кадрам и метрикам ролика ты восстанавливаешь промпт, который мог бы сгенерировать это видео в моделях вроде Veo, Sora, Kling или Runway.
Отвечай СТРОГО валидным JSON без пояснений и без markdown-обёрток в формате:
{"ru": "<промпт на русском, 2-4 предложения, конкретика: объект, действие, свет, оптика, движение камеры, цвет, настроение>", "en": "<the same prompt in English>", "tags": ["<5-10 коротких ключевых тегов на английском>"]}
Не выдумывай логотипы и имена людей. Если объект неочевиден — описывай форму, материал и поведение.`;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "AI-модуль не активирован: не задан OPENAI_API_KEY. Работает локальный анализатор — он измеряет свет, цвет, движение и оптику без внешних вызовов.",
        code: "no_api_key",
      },
      { status: 501 },
    );
  }

  let body: EnrichRequest;
  try {
    body = (await request.json()) as EnrichRequest;
  } catch {
    return Response.json({ error: "Тело запроса должно быть JSON" }, { status: 400 });
  }

  const frames = (body.frames ?? []).filter((f) => typeof f === "string" && f.startsWith("data:image/")).slice(0, 4);
  if (!frames.length) {
    return Response.json({ error: "Пришлите хотя бы один кадр в формате data URL" }, { status: 400 });
  }

  const baseUrl = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Метрики ролика:\n${(body.summary ?? "").slice(0, 3000)}\n\nТеги автора (если есть): ${
                  (body.tags ?? "").slice(0, 300) || "—"
                }`,
              },
              ...frames.map((f) => ({ type: "image_url", image_url: { url: f } })),
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return Response.json(
        { error: `Модель ответила ${response.status}`, detail: detail.slice(0, 500) },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(raw);
    if (!parsed) {
      return Response.json(
        { error: "Модель вернула ответ не в JSON", detail: raw.slice(0, 300) },
        { status: 502 },
      );
    }
    return Response.json({ ...parsed, model, source: "llm" });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return Response.json(
      {
        error: aborted ? "Модель не ответила вовремя" : "Не удалось связаться с моделью",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(raw: string): { ru: string; en: string; tags: string[] } | null {
  const candidates: string[] = [raw.trim()];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const braces = raw.match(/\{[\s\S]*\}/);
  if (braces?.[0]) candidates.push(braces[0]);

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate) as Record<string, unknown>;
      const ru = typeof value.ru === "string" ? value.ru.trim() : "";
      const en = typeof value.en === "string" ? value.en.trim() : "";
      if (!ru && !en) continue;
      const tags = Array.isArray(value.tags)
        ? value.tags.filter((t): t is string => typeof t === "string").slice(0, 12)
        : [];
      return { ru: ru || en, en: en || ru, tags };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
