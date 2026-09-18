import type { NextConfig } from "next";

// Две сборки из одного кода:
//   обычная            — с сервером, базой и AI-описанием;
//   NEXT_PUBLIC_STATIC=1 — статическая, для GitHub Pages
//                        (https://sergei-dell.github.io/revers-lab/).
const статическая = process.env.NEXT_PUBLIC_STATIC === "1";

const nextConfig: NextConfig = статическая
  ? {
      output: "export",
      basePath: "/revers-lab",
      assetPrefix: "/revers-lab",
      images: { unoptimized: true },
    }
  : {};

export default nextConfig;
