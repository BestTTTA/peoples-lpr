import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai } from "next/font/google";
import Header from "@/components/Header";
import "./globals.css";

const plex = IBM_Plex_Sans_Thai({
  variable: "--font-plex",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const description =
  "Peoples LPR powered by Solutionmania: แจ้งพบและค้นหาป้ายทะเบียนรถที่หาย พร้อมตำแหน่งบนแผนที่";

export const metadata: Metadata = {
  // Share previews need absolute image URLs; the image itself is app/opengraph-image.jpg.
  metadataBase: new URL(process.env.SITE_URL ?? "https://peoples-lpr.roljetson.com"),
  title: "Peoples LPR — ตามหาป้ายทะเบียนหาย",
  description,
  applicationName: "Peoples LPR",
  authors: [{ name: "Thetigerteam Foundation Technology" }],
  creator: "Thetigerteam Foundation Technology",
  openGraph: {
    type: "website",
    siteName: "Peoples LPR",
    locale: "th_TH",
    title: "น้ำท่วม ป้ายทะเบียนหาย? ตามหาได้ฟรี — Peoples LPR",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "น้ำท่วม ป้ายทะเบียนหาย? ตามหาได้ฟรี — Peoples LPR",
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
      </body>
    </html>
  );
}
