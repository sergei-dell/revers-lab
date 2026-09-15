import type { NextConfig } from "next";

// Статическая сборка для GitHub Pages: сайт живёт по адресу
// https://sergei-dell.github.io/revers-lab/, сервера нет.
const nextConfig: NextConfig = {
  output: "export",
  basePath: "/revers-lab",
  assetPrefix: "/revers-lab",
  images: { unoptimized: true },
};

export default nextConfig;
