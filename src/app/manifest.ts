import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "اسی‌فیت — مربی هوشمند تناسب اندام",
    short_name: "اسی‌فیت",
    description:
      "اکوسیستم کامل تناسب اندام فارسی: تمرین حرفه‌ای، تغذیه دقیق، آمادگی روزانه و تحلیل پیشرفت — بهینه برای نصب روی موبایل.",
    lang: "fa",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0D12",
    theme_color: "#0A0D12",
    categories: ["fitness", "health", "sports"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "تمرین زنده", url: "/workout/live", description: "شروع سریع جلسه تمرین" },
      { name: "تغذیه امروز", url: "/nutrition", description: "ثبت وعده و آب" },
      { name: "پیشرفت", url: "/analytics", description: "تحلیل پیشرفت تمرینی" },
    ],
  };
}
