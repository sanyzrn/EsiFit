export const metadata = {
  title: "آفلاین هستید",
};

export default function OfflinePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="text-5xl" aria-hidden>📴</span>
      <h1 className="text-2xl font-bold">اتصال اینترنت قطع است</h1>
      <p className="text-esi-text-secondary text-sm max-w-sm leading-6">
        نگران نباشید — تمرین فعال و داده‌های ثبت‌شده روی دستگاه شما محفوظ است و به‌محض اتصال، خودکار همگام می‌شود.
      </p>
      <a
        href="/"
        className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        تلاش دوباره
      </a>
    </div>
  );
}
