import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const hyPixel = localFont({
  src: "./fonts/HYPixel13px-J.ttf",
  variable: "--font-hypixel",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "PPO Explainer",
  description: "DaisyUI-styled PPO agent network visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      data-theme="corporate"
      className={`${geistSans.variable} ${hyPixel.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-base-200 text-base-content">
        {children}
      </body>
    </html>
  );
}
