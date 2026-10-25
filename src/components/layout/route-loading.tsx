import { BrandLoader } from "@/components/ui/brand-loader";

export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-dvh items-center justify-center bg-background">
      <BrandLoader />
    </main>
  );
}
