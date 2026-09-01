import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // pdfkit uses __dirname to read .afm font metric files at runtime.
  // If bundled by Turbopack, __dirname becomes wrong and the reads fail.
  // Mark it as an external package so Next.js loads it as-is from node_modules.
  serverExternalPackages: ["pdfkit", "@pdfkit/fontkit"],
};

export default nextConfig;
