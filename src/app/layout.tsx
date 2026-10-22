import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import { CommandPalette } from "@/components/command-palette";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
});

const prompt = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-prompt",
});

export const metadata: Metadata = {
  title: "Southbank",
  description: "Write what you’re working on and meet people who share the words. Swipe right to connect.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = (await cookies()).get("southbank.theme")?.value;
  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined}>
      <body className={`${sans.variable} ${prompt.variable} font-sans antialiased`}>
        <CommandPalette />
        {children}
      </body>
    </html>
  );
}
