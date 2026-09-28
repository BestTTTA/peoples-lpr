import type { MetadataRoute } from "next";
import { FOUND_PATH, REPORT_PATH, href } from "@/lib/urls";

const BASE = process.env.SITE_URL ?? "https://xn--o3cecc9acb5exbrh6a5k3e.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}${href(FOUND_PATH)}`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}${href(REPORT_PATH)}`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
