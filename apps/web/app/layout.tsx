import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InstaCloud",
  description: "Share photos with people you follow.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
