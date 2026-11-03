import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITO_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/operativo", "/api/", "/account", "/carrello", "/checkout", "/ordine/"] }], sitemap: `${base}/sitemap.xml` };
}
