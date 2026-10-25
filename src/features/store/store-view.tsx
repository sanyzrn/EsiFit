"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/ui/icon";
import { api, errorMessage } from "@/lib/client/api";
import { useToast } from "@/hooks/use-toast";
import { formatToman, toPersianDigits } from "@/lib/formatting/numbers";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { formatJalaliLong } from "@/lib/dates/jalali";
import { loginPath } from "@/lib/auth/return-path";
import type { Catalog, CatalogProduct } from "@/lib/commerce/catalog-types";
import type { OrderReceipt } from "@/lib/commerce/orders";

type Product = CatalogProduct;

type CartLine = { product: Product; qty: number };

export function StoreView({ signedIn, initialCatalog }: { signedIn: boolean; initialCatalog: Catalog | null }) {
  const [products, setProducts] = React.useState<Product[] | null>(initialCatalog?.products ?? null);
  const [discount, setDiscount] = React.useState(initialCatalog?.discountPercent ?? 0);
  const [catalogError, setCatalogError] = React.useState<string | null>(initialCatalog ? null : "بارگذاری فروشگاه انجام نشد. دوباره تلاش کنید.");
  const [catalogLoading, setCatalogLoading] = React.useState(false);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [orders, setOrders] = React.useState<OrderReceipt[] | null>(null);
  const [ordersNext, setOrdersNext] = React.useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [ordersError, setOrdersError] = React.useState<string | null>(null);
  const [checkout, setCheckout] = React.useState(false);
  const [order, setOrder] = React.useState<OrderReceipt | null>(null);
  const { toast } = useToast();
  const reduce = useReducedMotion();

  const reloadCatalog = async () => {
    setCatalogLoading(true); setCatalogError(null);
    try { const result = await api<Catalog>("/api/store/products"); setProducts(result.products); setDiscount(result.discountPercent); }
    catch (error) { setCatalogError(errorMessage(error)); }
    finally { setCatalogLoading(false); }
  };

  const loadOrders = React.useCallback(async (cursor: string | null = null) => {
    setOrdersLoading(true); setOrdersError(null);
    try {
      const result = await api<{ orders: OrderReceipt[]; nextCursor: string | null }>(`/api/store/orders${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
      setOrders(previous => cursor ? [...new Map([...(previous ?? []), ...result.orders].map(receipt => [receipt.id, receipt])).values()] : result.orders);
      setOrdersNext(result.nextCursor);
    } catch (error) { setOrdersError(errorMessage(error)); }
    finally { setOrdersLoading(false); }
  }, []);
  React.useEffect(() => { if (historyOpen && orders === null) void loadOrders(); }, [historyOpen, orders, loadOrders]);

  const addToCart = (p: Product) => {
    setCart((c) => {
      const existing = c.find((l) => l.product.id === p.id);
      if (existing) {
        return c.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { product: p, qty: 1 }];
    });
    toast({ title: "به سبد اضافه شد", description: p.name });
  };

  const total = cart.reduce((a, l) => a + l.product.finalPriceToman * l.qty, 0);
  const count = cart.reduce((a, l) => a + l.qty, 0);

  const doCheckout = async () => {
    setCheckout(true);
    try {
      const res = await api<{ order: OrderReceipt; message: string }>("/api/store/checkout", {
        method: "POST",
        json: { items: cart.map((l) => ({ productId: l.product.id, qty: l.qty })) },
      });
      setOrder(res.order);
      setCart([]); setOrders(null); setOrdersNext(null); setOrdersError(null);
    } catch (e) {
      toast({ title: "پرداخت ناموفق", description: errorMessage(e), variant: "destructive" });
    } finally {
      setCheckout(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto w-full pb-6">
      <PageHeader
        title="فروشگاه اسی‌فیت"
        description={
          !signedIn
            ? "کاتالوگ عمومی — برای خرید وارد حساب شوید."
            : discount > 0
              ? `به عنوان عضو ویژه، ${toPersianDigits(discount)}٪ تخفیف روی همه اقلام دارید.`
              : "تجهیزات منتخب برای تمرین بهتر."
        }
        backHref={signedIn ? "/dashboard" : "/"}
        action={
          <div className="flex flex-wrap gap-2">
            {signedIn && <Button variant="secondary" className="min-h-11" onClick={() => setHistoryOpen(true)}>سفارش‌های من</Button>}
          <Button variant="secondary" className="h-11 relative active:scale-[0.98] transition-transform" onClick={() => setCartOpen(true)}>
            <Icon name="ShoppingCart" size={18} />
            سبد خرید
            {count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
                className="absolute -top-1.5 -end-1.5 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 tabular-nums"
              >
                {toPersianDigits(count)}
              </motion.span>
            )}
          </Button>
          </div>
        }
      />

      <div className="px-4 lg:px-8">
        {catalogError && <div role="alert" className="mb-4 rounded-2xl border border-destructive/30 p-4 text-sm"><p>{catalogError}</p><Button variant="secondary" className="mt-3 min-h-11" disabled={catalogLoading} onClick={() => void reloadCatalog()}>{catalogLoading ? "در حال بارگذاری…" : "تلاش دوباره"}</Button></div>}
        {products?.length === 0 && <p className="py-12 text-center text-sm text-esi-text-secondary">هنوز محصولی در فروشگاه موجود نیست. کمی بعد دوباره سر بزنید.</p>}
        {!products && catalogLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products?.map((p, i) => (
              <motion.article
                key={p.id}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0.01 : 0.32, delay: reduce ? 0 : Math.min(i * 0.04, 0.28) }}
                className="group flex flex-col esi-card rounded-3xl p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-raised)]"
              >
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-3xl" aria-hidden>{p.emoji}</span>
                  {p.badge && (
                    <span className="rounded-full bg-amber-400/12 px-2.5 py-1 text-[10px] font-semibold text-amber-400">{p.badge}</span>
                  )}
                </div>
                <h2 className="mt-4 text-sm font-bold leading-6">{p.name}</h2>
                <p className="mt-1.5 flex-1 text-[12px] leading-5 text-esi-text-secondary line-clamp-2">{p.description}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold tabular-nums">{formatToman(p.finalPriceToman)}</p>
                    {p.compareAtToman && (
                      <p className="text-[11px] text-esi-text-muted line-through tabular-nums">{formatToman(p.compareAtToman)}</p>
                    )}
                  </div>
                  <Button size="sm" className="h-9 active:scale-[0.97] transition-transform" onClick={() => addToCart(p)}>افزودن</Button>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent className="overflow-y-auto bg-surface-1">
          <SheetHeader>
            <SheetTitle>سفارش‌های من</SheetTitle>
            <SheetDescription>رسیدهای ثبت‌شدهٔ محیط آزمایشی؛ هیچ پرداخت واقعی انجام نشده است.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {ordersError && <div role="alert" className="rounded-2xl border border-destructive/30 p-4 text-sm text-destructive">
              <p>{ordersError}</p>
              <Button variant="secondary" className="mt-3 min-h-11" disabled={ordersLoading} onClick={() => void loadOrders(orders?.length ? ordersNext : null)}>تلاش دوباره</Button>
            </div>}
            {ordersLoading && orders === null ? <Skeleton className="h-48 rounded-2xl" /> : orders?.length === 0 ? <div className="rounded-2xl border border-border p-5 text-sm leading-7 text-esi-text-secondary">هنوز سفارشی ثبت نکرده‌اید. از فروشگاه محصولی انتخاب کنید؛ رسید آن همین‌جا می‌ماند.</div> : orders?.map(receipt => <article key={receipt.id} className="rounded-2xl border border-border bg-surface-2 p-4">
              <p className="text-sm font-bold">{formatJalaliLong(new Date(receipt.createdAt))}</p>
              <p className="mt-1 text-xs text-esi-text-muted">{receipt.status === "paid" ? "ثبت پرداخت آزمایشی" : receipt.status === "canceled" ? "لغوشده" : "در انتظار"}</p>
              <p className="mt-2 break-all text-xs text-esi-text-muted">شناسه: <span dir="ltr">{receipt.id}</span></p>
              {receipt.items.length ? <ul className="mt-3 space-y-2">{receipt.items.map((item, index) => <li key={`${item.productId}:${index}`} className="text-sm leading-6">
                <p>{item.nameFa} × {toPersianDigits(item.qty)}</p>
                <p className="text-xs text-esi-text-secondary">{item.unitPriceToman != null ? `قیمت واحد: ${formatToman(item.unitPriceToman)}` : `قیمت پایهٔ ثبت‌شده: ${formatToman(item.priceToman)}`}</p>
              </li>)}</ul> : <p className="mt-3 text-xs text-esi-text-muted">جزئیات اقلام این رسید در دسترس نیست.</p>}
              <p className="mt-4 text-sm font-bold">جمع ثبت‌شده: {formatToman(receipt.totalToman)}</p>
              {receipt.discountToman > 0 && <p className="mt-1 text-xs text-esi-text-secondary">تخفیف: {formatToman(receipt.discountToman)}</p>}
            </article>)}
            {ordersNext && <Button variant="secondary" className="min-h-11 w-full" disabled={ordersLoading} onClick={() => void loadOrders(ordersNext)}>{ordersLoading ? "در حال بارگذاری…" : "سفارش‌های بیشتر"}</Button>}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60"
            role="dialog"
            aria-modal="true"
            aria-label="سبد خرید"
            onClick={() => setCartOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="absolute end-0 top-0 h-dvh w-full max-w-md bg-surface-1 border-s border-border flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="font-bold">سبد خرید</h2>
                <button type="button" onClick={() => setCartOpen(false)} aria-label="بستن" className="h-10 w-10 rounded-full bg-surface-2 flex items-center justify-center">
                  <Icon name="X" size={18} />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <p className="py-16 text-center text-sm text-esi-text-muted">سبد خرید خالی است</p>
                ) : (
                  cart.map((l) => (
                    <div key={l.product.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                      <span className="text-2xl" aria-hidden>{l.product.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{l.product.name}</p>
                        <p className="text-[11px] tabular-nums text-esi-text-muted">{formatToman(l.product.finalPriceToman)} × {toPersianDigits(l.qty)}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`حذف ${l.product.name}`}
                        className="h-9 w-9 rounded-full text-esi-text-muted hover:text-destructive"
                        onClick={() => setCart((c) => c.filter((x) => x.product.id !== l.product.id))}
                      >
                        <Icon name="Trash2" size={15} className="mx-auto" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <footer className="border-t border-border p-5 space-y-3">
                  {discount > 0 && (
                    <p className="flex justify-between text-xs text-primary">
                      <span>تخفیف عضویت ویژه ({toPersianDigits(discount)}٪)</span>
                      <span className="tabular-nums">−{formatToman(Math.round(total / (1 - discount / 100) - total))}</span>
                    </p>
                  )}
                  <p className="flex justify-between text-sm font-bold">
                    <span>مبلغ نهایی</span>
                    <span className="tabular-nums">{formatToman(total)}</span>
                  </p>
                  <Button className="w-full h-12 esi-glow" disabled={checkout || !signedIn} onClick={() => void doCheckout()}>
                    {checkout ? "در حال پردازش…" : "تکمیل خرید"}
                  </Button>
                  <p className="text-center text-[10px] text-esi-text-muted">پرداخت آزمایشی محیط دمو — بدون تراکنش واقعی</p>
                </footer>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Order success */}
      <AnimatePresence>
        {order && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-label="سفارش ثبت شد"
            onClick={() => setOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              className="w-full max-w-sm esi-card rounded-3xl p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-4xl" aria-hidden>✅</span>
              <h2 className="mt-3 text-xl font-bold">سفارش ثبت شد!</h2>
              <p className="mt-2 text-sm text-esi-text-secondary">
                مبلغ {formatToman(order.totalToman)} ثبت شد
                {order.discountToman > 0 ? ` — ${formatToman(order.discountToman)} صرفه‌جویی بابت عضویت ویژه.` : "."}
              </p>
              <Button className="mt-6 w-full h-11" onClick={() => setOrder(null)}>بازگشت به فروشگاه</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
