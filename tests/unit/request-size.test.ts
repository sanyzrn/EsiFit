import { describe, expect, it } from "vitest";
import { MAX_JSON_BYTES, readJson } from "@/lib/http/read-json";
import { appErrorResponse } from "@/lib/errors/respond";
const request = (body: string, headers?: Record<string,string>) => new Request("http://localhost/api/test", {method:"POST",body,headers});
describe("bounded JSON request parsing", () => {
  it("rejects declared and actual oversized bodies with 413", async () => {
    for (const req of [request("{}",{"Content-Length":String(MAX_JSON_BYTES+1)}), request(JSON.stringify({value:"a".repeat(MAX_JSON_BYTES)}))]) {
      try { await readJson(req); throw new Error("not rejected"); } catch(error) { expect(appErrorResponse(error).status).toBe(413); }
    }
  });
  it("caps chunked streams and cancels before consuming the remaining payload", async () => {
    let canceled=false;let chunks=0;
    const stream=new ReadableStream<Uint8Array>({pull(c){chunks++;c.enqueue(new Uint8Array(MAX_JSON_BYTES/2));},cancel(){canceled=true}});
    const req=new Request("http://localhost/api/test",{method:"POST",body:stream,duplex:"half"} as RequestInit);
    await expect(readJson(req)).rejects.toMatchObject({code:"payload_too_large"});expect(canceled).toBe(true);expect(chunks).toBeLessThan(6);
  });
  it("returns validation for malformed JSON and preserves explicit empty-body support", async () => {
    await expect(readJson(request("{"))).rejects.toMatchObject({code:"validation"});
    expect(await readJson(request(""),{allowEmpty:true})).toEqual({});
    expect(await readJson(request(JSON.stringify({name:"ورزشکار"})))).toEqual({name:"ورزشکار"});
  });
});
