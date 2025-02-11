import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { initializeAuth } from "@/lib/auth";
import { Suspense } from "react";
import VersionAlert from "@/components/UpdateAlert";
import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import "@/logging/logger";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata = {
  title: "ALPR Database",
  description: "Your ALPR Database",
};

export default async function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark:bg-neutral-950`}
      >
        <Suspense fallback={<DashboardSkeleton />}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
            <VersionAlert />
            {children}
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
