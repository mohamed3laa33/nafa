// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "./AuthContext";
import GlobalAuth from "./GlobalAuth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Calls Dashboard",
  description: "Track open and closed stock calls with live updates",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Strip extension-injected attributes (e.g., ColorZilla) before hydration */}
        <Script id="strip-cz" strategy="beforeInteractive">{`
          (function tryStrip(){
            var b = document.body;
            if (!b) return setTimeout(tryStrip, 0);
            // remove the attribute if a browser extension added it before hydration
            try { b.removeAttribute('cz-shortcut-listen'); } catch {}
          })();
        `}</Script>
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} antialiased min-h-screen bg-gray-50 text-slate-900`}
      >
        <AuthProvider>
          <GlobalAuth>
            <div className="max-w-7xl mx-auto px-4 py-4">
              {children}
            </div>
          </GlobalAuth>
        </AuthProvider>
      </body>
    </html>
  );
}
