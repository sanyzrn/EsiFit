"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/client/api";
export function CoachNote({ athleteId, initialNote }: { athleteId: string; initialNote: string }) {
  const router = useRouter(); const [note,setNote]=React.useState(initialNote); const [busy,setBusy]=React.useState(false); const [error,setError]=React.useState(""); const [saved,setSaved]=React.useState(false);
  return <section className="esi-card rounded-3xl p-5" aria-label="یادداشت پیگیری مربی"><h2 className="font-bold">یادداشت پیگیری</h2><p className="mt-2 text-xs text-esi-text-secondary">یادداشت این ارتباط مربیگری؛ به‌عنوان پیام برای ورزشکار ارسال نمی‌شود.</p><label className="mt-4 block text-xs font-semibold">یادداشت<Textarea className="mt-2" value={note} maxLength={1000} disabled={busy} onChange={e=>{setNote(e.target.value);setSaved(false);}}/></label>{error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}{saved&&<p role="status" className="mt-3 text-sm text-primary">یادداشت ذخیره شد.</p>}<Button className="mt-3" variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await api("/api/coach/note",{method:"PATCH",json:{athleteId,note}});setSaved(true);router.refresh();}catch(e){setError(errorMessage(e));}finally{setBusy(false);}}}>{busy?"در حال ذخیره…":"ذخیره یادداشت"}</Button></section>;
}
