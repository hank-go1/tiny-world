import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiny World · Decision Playground",
  description: "Change their world with a sentence. Compare OpenAI Decisions and Jev in an interactive creature world.",
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
