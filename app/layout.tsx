import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import { connection } from "next/server";
import Header from "@/components/Header";
import WatchAlert from "@/components/WatchAlert";
import { getBranding } from "@/lib/branding";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  variable: "--font-plex",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Per request: the share preview (title, description, image) is set on /admin,
 * and the image is built without secrets or a database, so nothing here may be
 * frozen at build time.
 */
export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const b = await getBranding();
  const image = { url: `/api/branding/og?v=${b.ogVersion}`, width: 1200, height: 630, alt: b.ogAlt, type: "image/jpeg" };
  return {
    // Share previews need absolute URLs. The host is ป้ายทะเบียนหาย.com in
    // punycode, which every crawler understands.
    metadataBase: new URL(process.env.SITE_URL ?? "https://xn--o3cecc9acb5exbrh6a5k3e.com"),
    title: "ตามหาป้ายทะเบียนหาย — ป้ายทะเบียนหาย.com",
    description: b.ogDescription,
    applicationName: "ป้ายทะเบียนหาย.com",
    // Served from settings so an admin can change it on /admin (default: public/brand-logo.png).
    icons: { icon: { url: "/api/branding/logo", type: "image/png" }, apple: "/api/branding/logo" },
    authors: [{ name: "Thetigerteam Foundation Technology" }],
    creator: "Thetigerteam Foundation Technology",
    openGraph: {
      type: "website",
      siteName: "ป้ายทะเบียนหาย.com",
      locale: "th_TH",
      title: b.ogTitle,
      description: b.ogDescription,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: b.ogTitle, description: b.ogDescription, images: [image] },
  };
}

export const viewport: Viewport = {
  themeColor: "#2b3336",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plex.variable} h-full antialiased`}>
      <body className="flex h-full flex-col">
        <Header />
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
        <WatchAlert />
      </body>
    </html>
  );
}
