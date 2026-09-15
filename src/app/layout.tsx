import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "РЕВЕРС — видео → промпт → кадры",
  description:
    "Лаборатория обратной генерации: загрузите видео, получите детальный промпт для генеративных моделей и разберите ролик на покадровые изображения.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-void text-chalk antialiased">{children}</body>
    </html>
  );
}
