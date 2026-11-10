import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flat Fee Network",
  description: "Find a flat-fee financial advisor who fits you.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
