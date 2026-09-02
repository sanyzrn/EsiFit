import { NextRequest } from "next/server";

/** Build a NextRequest-compatible POST for route-handler tests. */
export function nextPost(url: string, body: unknown): NextRequest {
  return new NextRequest(new Request(`http://localhost${url}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
}

export function nextReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new Request(`http://localhost${url}`, init));
}
