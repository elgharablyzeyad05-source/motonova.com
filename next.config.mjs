import path from "node:path";
import { fileURLToPath } from "node:url";
const qui = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "pg", "bcryptjs", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "40mb" } },
  // L'alias @/ va dichiarato anche qui: tsconfig da solo non basta per la build.
  webpack(cfg) {
    cfg.resolve.alias["@"] = path.join(qui, "src");
    return cfg;
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
      ],
    }];
  },
};
export default config;
