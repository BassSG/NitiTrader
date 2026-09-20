import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Niti Trader",
  description: "วิเคราะห์ XAUUSD และบันทึก Paper Trading",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/niti-trader-logo.png",
    shortcut: "/niti-trader-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
