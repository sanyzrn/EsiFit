import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ServiceWorkerRegistrar } from "@/components/layout/service-worker-registrar";

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
  preload: true,
});

export const metadata: Metadata = {
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
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    title: "اسی‌فیت | مربی هوشمند تناسب اندام",
    description:
      "تمرین، تغذیه، ریکاوری و تحلیل پیشرفت — اکوسیستم کامل تناسب اندام فارسی، بهینه برای موبایل.",
    siteName: "اسی‌فیت",
    type: "website",
    locale: "fa_IR",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0D12" },
    { media: "(prefers-color-scheme: light)", color: "#F5F7FA" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${vazir.variable} antialiased bg-background text-foreground min-h-screen`}>
        <ThemeProvider defaultTheme="dark" storageKey="esifit-theme">
          {children}
          <Toaster position="top-center" dir="rtl" richColors closeButton />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
