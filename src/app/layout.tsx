import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "WK Pool Predictor",
  description: "Transparent, rule-based World Cup match advice for your Scorito pool.",
};

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/teams", label: "Teams" },
  { href: "/matches", label: "Matches" },
  { href: "/settings", label: "Settings" },
  { href: "/export", label: "Export" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <Link href="/" className="text-lg font-bold text-brand">
                ⚽ WK Pool Predictor
              </Link>
              <nav className="flex flex-wrap gap-1">
                {nav.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                  >
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
          <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-400">
            Personal tool. Helps you decide what to enter in Scorito manually — it does not connect
            to, scrape, or submit anything to Scorito.
          </footer>
        </div>
      </body>
    </html>
  );
}
