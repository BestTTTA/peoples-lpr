import type { MetadataRoute } from "next";

const BASE = process.env.SITE_URL ?? "https://xn--o3cecc9acb5exbrh6a5k3e.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
