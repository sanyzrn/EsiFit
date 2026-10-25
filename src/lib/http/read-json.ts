import { AppError } from "@/lib/errors/app-error";
export const MAX_JSON_BYTES = 1024 * 1024;
/** Enforce bytes before JSON/Zod allocation, including chunked/unknown-length bodies. */
export async function readJson(req: Request, { allowEmpty = false }: { allowEmpty?: boolean } = {}): Promise<unknown> {
  const size = req.headers.get("Content-Length");
  if (size && /^\d+$/.test(size) && Number(size) > MAX_JSON_BYTES) throw new AppError("payload_too_large");
  const reader = req.body?.getReader();
  if (!reader) { if (allowEmpty) return {}; throw new AppError("validation"); }
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0; let text = "";
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_JSON_BYTES) { await reader.cancel(); throw new AppError("payload_too_large"); }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    if (!bytes && allowEmpty) return {};
    try { return JSON.parse(text); } catch { throw new AppError("validation"); }
  } catch (error) {
    if (error instanceof TypeError) throw new AppError("validation", { cause: error });
    throw error;
  } finally { reader.releaseLock(); }
}
