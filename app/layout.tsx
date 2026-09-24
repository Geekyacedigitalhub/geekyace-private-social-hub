import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GeekyAce Private Social Hub",
  description: "Private social-service order control panel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
