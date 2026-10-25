import { isIP } from "node:net";

/** Vercel overwrites these headers. Self-hosted ingress must be explicitly trusted
 * and block direct access; arbitrary Cloudflare/client headers are never trusted. */
export function clientIp(req: Request): string | null {
  let value: string | undefined;
  if (process.env.VERCEL === "1") {
    value = (req.headers.get("x-vercel-forwarded-for") ?? req.headers.get("x-forwarded-for"))?.trim();
  } else if (process.env.TRUST_PROXY === "true") {
    value = req.headers.get("x-forwarded-for")?.split(",").pop()?.trim();
  }
  return value && isIP(value) ? value : null;
}
