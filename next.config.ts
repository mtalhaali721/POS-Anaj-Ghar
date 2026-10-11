import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/POS-Anaj-Ghar",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["127.0.0.1", "0.0.0.0", "172.30.0.2"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
