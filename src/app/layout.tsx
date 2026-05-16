import type { Metadata } from "next";
import { Anton, Archivo, IBM_Plex_Mono } from "next/font/google";

import "./globals.css";

// Anton — ultra-condensed industrial signage face, used only for the masthead
// and section markers. Archivo — engineered grotesque for body/UI. Plex Mono —
// intentional monospace for data readouts (times, match scores), reinforcing
// the warehouse/spec-sheet concept rather than a lazy "developer" default.
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});

const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sound City — Chicago house & techno",
  description:
    "Source-verified discovery for Chicago underground house and techno.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
