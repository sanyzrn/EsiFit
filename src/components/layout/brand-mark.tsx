import Link from "next/link";
import Image from "next/image";

/** Shared non-interactive mark for navigation and loading states. */
export function BrandLogo({ size = 42, className }: { size?: number; className?: string }) {
  return <Image src="/icons/logo-mark.svg" alt="" width={size} height={size} className={className} />;
}

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center justify-center" aria-label="اسی‌فیت — صفحه اصلی">
      <BrandLogo />
    </Link>
  );
}
