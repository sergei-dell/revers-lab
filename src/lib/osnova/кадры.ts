"use client";



/*  КАДРЫ ДЛЯ ПАКЕТА.

    Claude не умеет смотреть видео, поэтому в пакет кладутся картинки:
    раскадровка каждые полсекунды и ключевые кадры — начало, каждая
    склейка, конец.

    Снимает их сервер через ffmpeg. Раньше это делал браузер перемоткой
    `<video>`: на коротком mp4 выходило, а на настоящем ролике на 35
    секунд все кадры оказывались одним и тем же первым кадром. Браузер
    тут только складывает лист и подписывает времена.                */

export type КадрПакета = {
  имя: string;
  время: number;
  blob: Blob;
};

export type КадрыДляПакета = {
  раскадровка: Blob;
  ключевые: КадрПакета[];
  /** Времена склеек, найденные ffmpeg. */
  смены: number[];
};

type ОтветСервера = {
  раскадровка: Array<{ файл: string; время: number }>;
  ключевые: Array<{ файл: string; время: number }>;
  склейки: number[];
  длительность: number;
  шаг: number;
  error?: string;
};

function адрес(id: string, файл: string): string {
  return `/api/osnova/${id}/${файл.split("/").map(encodeURIComponent).join("/")}`;
}

/*  Лист раскадровки складываем в браузере: так под каждым кадром
    остаётся его время, а серверу не нужен шрифт для подписей.      */
function холст(ш: number, в: number): HTMLCanvasElement {
  const э = document.createElement("canvas");
  э.width = Math.max(1, Math.round(ш));
  э.height = Math.max(1, Math.round(в));
  return э;
}

function вBlob(э: HTMLCanvasElement, качество = 0.92): Promise<Blob> {
  return new Promise((готово, беда) => {
    э.toBlob(
      (b) => (b ? готово(b) : беда(new Error("Не удалось сохранить лист"))),
      "image/jpeg",
      качество,
    );
  });
}

function картинка(адрес: string): Promise<HTMLImageElement> {
  return new Promise((готово, беда) => {
    const и = new Image();
    и.onload = () => готово(и);
    и.onerror = () => беда(new Error("Кадр не открылся"));
    и.src = адрес;
  });
}

async function сложитьЛист(кадры: Array<{ blob: Blob; время: number }>): Promise<Blob> {
  if (!кадры.length) {
    /*  Пустой лист всё равно должен быть картинкой: пакет без него
        выглядел бы как сбой.                                       */
    const э = холст(640, 120);
    const ctx = э.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0b0b10";
      ctx.fillRect(0, 0, 640, 120);
      ctx.fillStyle = "#f4f1ea";
      ctx.font = "500 20px sans-serif";
      ctx.fillText("Кадры не снялись", 20, 64);
    }
    return вBlob(э);
  }

  const ссылки: string[] = [];
  try {
    const картинки: HTMLImageElement[] = [];
    for (const к of кадры) {
      const адрес = URL.createObjectURL(к.blob);
      ссылки.push(адрес);
      картинки.push(await картинка(адрес));
    }

    const ширинаКадра = 320;
    const высотаКадра = Math.max(
      1,
      Math.round((картинки[0].height * ширинаКадра) / картинки[0].width),
    );
    const отступ = 10;
    const подпись = 26;
    const шапка = 54;
    /*  Колонок берём по корню из числа кадров: у ролика на полминуты
        это шесть-восемь столбцов, лист остаётся читаемым.          */
    const колонок = Math.min(10, Math.max(4, Math.round(Math.sqrt(картинки.length * 1.6))));
    const рядов = Math.ceil(картинки.length / колонок);

    const э = холст(
      колонок * ширинаКадра + отступ * (колонок + 1),
      шапка + рядов * (высотаКадра + подпись + отступ) + отступ,
    );
    const ctx = э.getContext("2d");
    if (!ctx) throw new Error("Холст недоступен");
    ctx.fillStyle = "#0b0b10";
    ctx.fillRect(0, 0, э.width, э.height);
    ctx.fillStyle = "#f4f1ea";
    ctx.font = "600 24px 'JetBrains Mono', monospace";
    ctx.fillText("Раскадровка · каждые 0,5 сек", отступ + 4, 36);

    картинки.forEach((и, i) => {
      const кол = i % колонок;
      const ряд = Math.floor(i / колонок);
      const x = отступ + кол * (ширинаКадра + отступ);
      const y = шапка + отступ + ряд * (высотаКадра + подпись + отступ);
      ctx.drawImage(и, x, y, ширинаКадра, высотаКадра);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, ширинаКадра - 1, высотаКадра - 1);
      ctx.fillStyle = "#ff6a2b";
      ctx.font = "500 14px 'JetBrains Mono', monospace";
      ctx.fillText(
        `${String(i + 1).padStart(3, "0")}  ${кадры[i].время.toFixed(2)}s`,
        x + 2,
        y + высотаКадра + 18,
      );
    });

    return await вBlob(э);
  } finally {
    for (const адрес of ссылки) URL.revokeObjectURL(адрес);
  }
}

export async function кадрыДляПакета(id: string): Promise<КадрыДляПакета> {
  const ответ = await fetch("/api/osnova/kadry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const данные = (await ответ.json()) as ОтветСервера;
  if (!ответ.ok) throw new Error(данные.error ?? `Сервер ответил ${ответ.status}`);

  const листКадры: Array<{ blob: Blob; время: number }> = [];
  for (const к of данные.раскадровка) {
    const о = await fetch(адрес(id, к.файл));
    if (о.ok) листКадры.push({ blob: await о.blob(), время: к.время });
  }

  const ключевые: КадрПакета[] = [];
  for (const к of данные.ключевые) {
    const о = await fetch(адрес(id, к.файл));
    if (!о.ok) continue;
    ключевые.push({
      имя: к.файл.split("/").pop() ?? "кадр.jpg",
      время: к.время,
      blob: await о.blob(),
    });
  }

  return {
    раскадровка: await сложитьЛист(листКадры),
    ключевые,
    смены: данные.склейки ?? [],
  };
}
