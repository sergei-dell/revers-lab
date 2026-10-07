import type { NextConfig } from "next";

/*  Настроек почти не осталось: сайт один, собирается обычным образом.
    Прежняя статическая сборка для GitHub Pages убрана вместе с тем,
    ради чего она была — разбором ролика в браузере.                */
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      /*  Ролик-тренд приходит целым файлом: предел по умолчанию в
          1 МБ режет его на подходе.                               */
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
