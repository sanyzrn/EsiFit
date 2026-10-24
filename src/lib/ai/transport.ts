import "server-only";
import { lookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent, fetch as secureFetch } from "undici";

export function isPublicAddress(address: string): boolean {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

/** Validate DNS at connection time, so a second resolution cannot rebind to a private host. */
const dispatcher = new Agent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true }, (error, addresses) => {
        if (error) return callback(error, [], 4);
        if (
          !addresses.length ||
          addresses.some((item) => !isPublicAddress(item.address))
        ) {
          return callback(
            new Error("Provider must resolve exclusively to public addresses"),
            [],
            4,
          );
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      });
    },
  },
});

export function providerFetch(baseUrl: string): typeof fetch {
  const origin = new URL(baseUrl).origin;
  return async (input, init) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (
      url.origin !== origin ||
      url.protocol !== "https:" ||
      (ipaddr.isValid(url.hostname.replace(/^\[|\]$/g, "")) &&
        !isPublicAddress(url.hostname.replace(/^\[|\]$/g, "")))
    ) {
      throw new Error("Invalid provider destination");
    }
    const response = await secureFetch(url, {
      ...(init as Parameters<typeof secureFetch>[1]),
      dispatcher,
      redirect: "error",
      signal: init?.signal ?? AbortSignal.timeout(25000),
    });
    // Models and text are bounded. Never buffer an unbounded gateway response.
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      try {
        for (;;) {
          const item = await reader.read();
          if (item.done) break;
          bytes += item.value.byteLength;
          if (bytes > 2_000_000) throw new Error("Provider response too large");
          chunks.push(item.value);
        }
      } finally {
        await reader.cancel();
      }
    }
    return new Response(Buffer.concat(chunks), {
      status: response.status,
      headers: Array.from(response.headers.entries()),
    });
  };
}
