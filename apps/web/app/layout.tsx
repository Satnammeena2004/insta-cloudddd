import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Momento — Share your moments",
  description: "A mobile-first community for sharing photos and moments.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
