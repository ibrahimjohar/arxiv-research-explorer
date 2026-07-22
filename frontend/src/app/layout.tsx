import type { Metadata } from "next";
import { Lora } from "next/font/google";
import { Fraunces } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Script from "next/script";

<Script id="theme-init" strategy="beforeInteractive">
  {`
    (function () {
      try {
        var stored = localStorage.getItem("theme");
        var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
        if (theme === "dark") document.documentElement.classList.add("dark");
      } catch (e) {}
    })();
  `}
</Script>

const lora = Lora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lora",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "arxiv research explorer",
  description: "full-text search and question answering over arxiv papers, updated daily",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fraunces.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = localStorage.getItem("theme");
                  var theme =
                    stored ||
                    (window.matchMedia("(prefers-color-scheme: dark)").matches
                      ? "dark"
                      : "light");
                  if (theme === "dark") document.documentElement.classList.add("dark");
                } catch (e) {}
              })();
            `,
          }}
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><Navbar />{children}</body>
    </html>
  );
}