import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UIR Motorsports Documentation Hub",
  description:
    "Controlled engineering records, evidence, reviews and Formula Student document generation.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
