export const dynamic = "force-dynamic";

const MAX_BYTES = 160 * 1024 * 1024;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h.startsWith("127.") || h.startsWith("10.") || h.startsWith("192.168.")) return true;
  if (h.startsWith("169.254.") || h.startsWith("0.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h === "[::1]") return true;
  return false;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return Response.json({ error: "Передайте параметр ?url=" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return Response.json({ error: "Некорректная ссылка" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return Response.json(
      { error: "Разрешены только http и https ссылки" },
      { status: 400 },
    );
  }
  if (isPrivateHost(parsed.hostname)) {
    return Response.json(
      { error: "Локальные и служебные адреса недоступны" },
      { status: 403 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReversLab/1.0)" },
    });
    if (!upstream.ok) {
      return Response.json(
        { error: `Источник вернул ${upstream.status}` },
        { status: 502 },
      );
    }
    const type = upstream.headers.get("content-type") ?? "video/mp4";
    if (!/^(video|image|application\/octet-stream|binary)/.test(type)) {
      return Response.json(
        { error: `Источник не похож на видео (content-type: ${type})` },
        { status: 415 },
      );
    }
    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return Response.json({ error: "Файл больше 160 МБ" }, { status: 413 });
    }
    if (buffer.byteLength === 0) {
      return Response.json({ error: "Источник пуст" }, { status: 502 });
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return Response.json(
      {
        error: aborted
          ? "Источник не ответил за 45 секунд"
          : "Не удалось загрузить видео по ссылке",
        detail: error instanceof Error ? error.message : undefined,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
