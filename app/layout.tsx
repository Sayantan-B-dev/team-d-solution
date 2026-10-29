import type { Metadata } from "next";
import { Space_Grotesk, Space_Mono } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap",
});

const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_NAME = "dlinkit";
const DESCRIPTION =
  "dlinkit turns long URLs into short links and records every click — time, device, browser and referrer — in a live analytics dashboard. Five free links a day without an account.";

export const metadata: Metadata = {
  applicationName: SITE_NAME,
  title: {
    default: "dlinkit — Link Shortener + Analytics",
    template: "%s — dlinkit",
  },
  description: DESCRIPTION,
  keywords: [
    "link shortener",
    "url shortener",
    "short links",
    "click analytics",
    "link tracking",
    "dlinkit",
  ],
  authors: [{ name: "Team D" }],
  creator: "Team D",
  publisher: SITE_NAME,
  category: "technology",
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "dlinkit — Short links. Real analytics.",
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "dlinkit — Short links. Real analytics.",
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("dlinkit_theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
