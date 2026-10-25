import { siteOrigin, SOCIAL_IMAGE } from "@/lib/seo/site";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/layout/service-worker-registrar";
import { InstallPrompt } from "@/components/features/install-prompt";
import { SpotlightProvider } from "@/components/motion/spotlight-provider";

const vazir = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
  preload: false,
});

/** Display face: chunky Persian poster lettering for headlines and big numerals. */
const lalezar = localFont({
  src: [{ path: "../../public/fonts/Lalezar-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-lalezar",
  display: "swap",
  preload: true,
});

/**
 * Absolute base for every generated URL (canonical, og:url, og:image).
 * Without it Next emits *relative* canonicals, which search engines ignore.
 * Set NEXT_PUBLIC_SITE_URL per environment.
 */
const siteUrl = siteOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "اسی‌فیت | مربی هوشمند تناسب اندام",
    template: "%s | اسی‌فیت",
  },
  description:
    "اسی‌فیت پلتفرم جامع تناسب اندام فارسی است: تمرین حرفه‌ای، تغذیه دقیق، آمادگی روزانه، تحلیل پیشرفت و مربی هوشمند — همه در یک اپلیکیشن.",
  keywords: [
    "تناسب اندام",
    "بدنسازی",
    "تمرین",
    "تغذیه",
    "سلامت",
    "کالری",
    "اسی‌فیت",
    "Esifit",
  ],
  applicationName: "اسی‌فیت",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "اسی‌فیت",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  alternates: { canonical: "/" },
  openGraph: {
    title: "اسی‌فیت | مربی هوشمند تناسب اندام",
    description:
      "تمرین، تغذیه، ریکاوری و تحلیل پیشرفت — اکوسیستم کامل تناسب اندام فارسی، بهینه برای موبایل.",
    siteName: "اسی‌فیت",
    type: "website",
    locale: "fa_IR",
    url: "/",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "اسی‌فیت | مربی هوشمند تناسب اندام",
    description:
      "تمرین، تغذیه، ریکاوری و تحلیل پیشرفت — اکوسیستم کامل تناسب اندام فارسی، بهینه برای موبایل.",
    images: [SOCIAL_IMAGE.url],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#F97316",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${vazir.variable} ${lalezar.variable} antialiased bg-background text-foreground min-h-screen`}>
        <ThemeProvider defaultTheme="dark" enableSystem={false} storageKey="esifit-theme">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-semibold focus:text-primary-foreground">پرش به محتوا</a>
          {children}
          <Toaster position="top-center" dir="rtl" richColors closeButton />
          <ServiceWorkerRegistrar />
          <InstallPrompt />
          <SpotlightProvider />
        </ThemeProvider>
      </body>
    </html>
  );
}
