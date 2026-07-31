// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createExternalFetcher,
  type ExternalTransportRequest,
} from "../external-fetcher";

async function* responseBody(body: string) {
  yield Buffer.from(body);
}

describe("external fetcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permits public HTTPS destinations and rejects unsafe destinations before requesting them", async () => {
    const transport = vi.fn(async () => ({
      status: 200,
      headers: { "content-type": "application/rss+xml" },
      body: responseBody("<rss />"),
    }));
    const resolveHostname = vi.fn(async (hostname: string) => [
      {
        address: hostname === "private.example" ? "192.168.1.20" : "93.184.216.34",
        family: 4 as const,
      },
    ]);
    const fetcher = createExternalFetcher({ resolveHostname, transport });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      body: "<rss />",
      contentType: "application/rss+xml",
      status: 200,
      finalUrl: "https://events.example/feed.xml",
    });

    const unsafeUrls = [
      "http://events.example/feed.xml",
      "https://user:secret@events.example/feed.xml",
      "https://127.0.0.1/feed.xml",
      "https://10.0.0.1/feed.xml",
      "https://169.254.169.254/feed.xml",
      "https://private.example/feed.xml",
      "https://[::1]/feed.xml",
      "https://[::2]/feed.xml",
      "https://[fc00::1]/feed.xml",
      "https://[fe80::1]/feed.xml",
    ];

    for (const url of unsafeUrls) {
      await expect(fetcher(url)).rejects.toThrow(/unsafe external fetch destination/i);
    }
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("identifies Sound City and follows at most three HTTPS redirects", async () => {
    const transport = vi.fn(async ({ url }: ExternalTransportRequest) => {
      const nextLocationByPath: Record<string, string> = {
        "/start": "/redirect-2",
        "/redirect-2": "/redirect-3",
        "/redirect-3": "/final",
      };
      const location = nextLocationByPath[url.pathname];
      return {
        status: location ? 302 : 200,
        headers: {
          "content-type": "application/rss+xml",
          location,
        },
        body: responseBody(location ? "" : "<rss />"),
      };
    });
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/start")).resolves.toMatchObject({
      body: "<rss />",
      finalUrl: "https://events.example/final",
    });
    expect(transport).toHaveBeenCalledTimes(4);
    for (const [request] of transport.mock.calls) {
      expect(request.headers["user-agent"]).toMatch(/sound city/i);
    }
  });

  it("rejects a fourth redirect", async () => {
    const transport = vi.fn(async ({ url }: ExternalTransportRequest) => ({
      status: 302,
      headers: { location: `/redirect-${Number(url.pathname.split("-").at(-1) ?? 0) + 1}` },
      body: responseBody(""),
    }));
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/redirect-0")).rejects.toThrow(
      /exceeded 3 redirects/i,
    );
    expect(transport).toHaveBeenCalledTimes(4);
  });

  it("rejects an HTTPS downgrade before requesting the redirect destination", async () => {
    const transport = vi.fn(async () => ({
      status: 302,
      headers: { location: "http://events.example/insecure" },
      body: responseBody(""),
    }));
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/start")).rejects.toThrow(
      /only HTTPS is permitted/i,
    );
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("aborts a request after 15 seconds", async () => {
    vi.useFakeTimers();
    const requestSignals: AbortSignal[] = [];
    const transport = vi.fn(
      async ({ signal }: ExternalTransportRequest) =>
        new Promise<never>((_resolve, reject) => {
          requestSignals.push(signal);
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    const pendingFetch = fetcher("https://events.example/feed.xml").catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(14_999);
    expect(requestSignals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(requestSignals[1]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(requestSignals[1]?.aborted).toBe(true);
    await expect(pendingFetch).resolves.toMatchObject({ code: "timeout" });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("applies the 15-second timeout while resolving DNS", async () => {
    vi.useFakeTimers();
    const resolveHostname = vi.fn(
      async () => new Promise<never>(() => undefined),
    );
    const transport = vi.fn();
    const fetcher = createExternalFetcher({ resolveHostname, transport });

    let settled = false;
    const pendingFetch = fetcher("https://events.example/feed.xml")
      .catch((error: unknown) => error)
      .finally(() => {
        settled = true;
      });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(resolveHostname).toHaveBeenCalledTimes(2);
    expect(transport).not.toHaveBeenCalled();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(settled).toBe(true);
    await expect(pendingFetch).resolves.toMatchObject({ code: "timeout" });
  });

  it("rejects a response larger than 5 MB", async () => {
    async function* oversizedBody() {
      yield Buffer.alloc(5 * 1024 * 1024);
      yield Buffer.alloc(1);
    }
    const transport = vi.fn(async () => ({
      status: 200,
      headers: { "content-type": "application/rss+xml" },
      body: oversizedBody(),
    }));
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).rejects.toMatchObject({
      code: "response-too-large",
    });
  });

  it("retries a server error once", async () => {
    let attempt = 0;
    const transport = vi.fn(async () => {
      attempt += 1;
      return {
        status: attempt === 1 ? 503 : 200,
        headers: { "content-type": "application/rss+xml" },
        body: responseBody(attempt === 1 ? "busy" : "<rss />"),
      };
    });
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      body: "<rss />",
      status: 200,
      retryCount: 1,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("retries a rate-limited response once", async () => {
    let attempt = 0;
    const transport = vi.fn(async () => {
      attempt += 1;
      return {
        status: attempt === 1 ? 429 : 200,
        headers: { "content-type": "application/rss+xml" },
        body: responseBody(attempt === 1 ? "rate limited" : "<rss />"),
      };
    });
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      status: 200,
      retryCount: 1,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("retries a network error once", async () => {
    let attempt = 0;
    const transport = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        throw Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
      }
      return {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
        body: responseBody("<rss />"),
      };
    });
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      status: 200,
      retryCount: 1,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not retry other client errors", async () => {
    const transport = vi.fn(async () => ({
      status: 404,
      headers: { "content-type": "text/plain" },
      body: responseBody("not found"),
    }));
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      status: 404,
      retryCount: 0,
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("stops after one retry when a transient response persists", async () => {
    const transport = vi.fn(async () => ({
      status: 503,
      headers: { "content-type": "text/plain" },
      body: responseBody("still busy"),
    }));
    const fetcher = createExternalFetcher({
      resolveHostname: async () => [{ address: "93.184.216.34", family: 4 }],
      transport,
    });

    await expect(fetcher("https://events.example/feed.xml")).resolves.toMatchObject({
      status: 503,
      retryCount: 1,
    });
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
