import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your PRs Are Too Big",
  description: "A funny little GitHub PR size auditor"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
