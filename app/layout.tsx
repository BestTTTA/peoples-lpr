import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import Header from "@/components/Header";
import WatchAlert from "@/components/WatchAlert";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  variable: "--font-plex",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const description =
  "ป้ายทะเบียนหาย.com (Peoples LPR): แจ้งพบและค้นหาป้ายทะเบียนรถที่หาย พร้อมตำแหน่งบนแผนที่";

export const metadata: Metadata = {
  // Share previews need absolute image URLs; the image itself is app/opengraph-image.jpg.
  // The host is ป้ายทะเบียนหาย.com in punycode, which every crawler understands.
  metadataBase: new URL(process.env.SITE_URL ?? "https://xn--o3cecc9acb5exbrh6a5k3e.com"),
  title: "ตามหาป้ายทะเบียนหาย — ป้ายทะเบียนหาย.com",
  description,
  applicationName: "ป้ายทะเบียนหาย.com",
  // Served from settings so an admin can change it on /admin (default: public/brand-logo.png).
  icons: { icon: { url: "/api/branding/logo", type: "image/png" }, apple: "/api/branding/logo" },
  authors: [{ name: "Thetigerteam Foundation Technology" }],
  creator: "Thetigerteam Foundation Technology",
  openGraph: {
    type: "website",
    siteName: "ป้ายทะเบียนหาย.com",
    locale: "th_TH",
    title: "เจอป้ายทะเบียนรถ? แจ้งพบได้ที่นี่ — ป้ายทะเบียนหาย.com",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "เจอป้ายทะเบียนรถ? แจ้งพบได้ที่นี่ — ป้ายทะเบียนหาย.com",
    description,
  },
};

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
