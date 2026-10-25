import Link from "next/link";
import Image from "next/image";

export function BrandMark() {
  return (
    <Link href="/" className="inline-flex items-center justify-center" aria-label="اسی‌فیت — صفحه اصلی">
      <Image src="/icons/logo-mark.svg" alt="" width={42} height={42} priority />
    </Link>
  );
}
