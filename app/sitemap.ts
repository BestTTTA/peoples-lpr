import type { MetadataRoute } from "next";
import { FOUND_PATH, PRIVACY_PATH, REPLACEMENT_GUIDE_PATH, REPORT_PATH, href } from "@/lib/urls";

const BASE = process.env.SITE_URL ?? "https://xn--o3cecc9acb5exbrh6a5k3e.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}${href(FOUND_PATH)}`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}${href(REPORT_PATH)}`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}${href(REPLACEMENT_GUIDE_PATH)}`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}${href(PRIVACY_PATH)}`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
