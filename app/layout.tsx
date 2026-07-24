import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const handwritingFont = localFont({
  src: "./fonts/PatrickHand-Regular.ttf",
  variable: "--font-handwriting",
  weight: "400",
  style: "normal",
  display: "swap",
});

const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");
const socialImageUrl = `${siteUrl}/og.png`;
const archiveAudioOrigins = [
  "https://ia800408.us.archive.org",
  "https://ia600408.us.archive.org",
  "https://archive.org",
];
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'none'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  `media-src 'self' ${archiveAudioOrigins.join(" ")}`,
  `connect-src 'self' ${archiveAudioOrigins.join(" ")}`,
  "upgrade-insecure-requests",
].join("; ");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "engpod — small step every day",
  description:
    "Learn English with 365 podcast conversations, searchable transcripts, level filters, shuffle, and automatic listening progress.",
  referrer: "strict-origin-when-cross-origin",
  manifest: `${assetBase}/manifest.webmanifest`,
  icons: {
    icon: `${assetBase}/favicon.svg`,
    shortcut: `${assetBase}/favicon.svg`,
    apple: `${assetBase}/logo.jpg`,
  },
  openGraph: {
    title: "engpod — small step every day",
    description:
      "A focused English listening library with 365 episodes, transcripts, level filters, shuffle, and automatic resume.",
    type: "website",
    images: [
      {
        url: socialImageUrl,
        width: 1731,
        height: 908,
        alt: "engpod — small step every day",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "engpod — small step every day",
    description:
      "A focused English listening library with 365 episodes and transcripts.",
    images: [socialImageUrl],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#101112" },
    { media: "(prefers-color-scheme: light)", color: "#f2efe8" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={handwritingFont.variable}
      suppressHydrationWarning
    >
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
      </head>
      <body>{children}</body>
    </html>
  );
}
