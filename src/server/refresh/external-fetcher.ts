import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

import type {
  FetchFailure,
  FetchFailureTelemetry,
  Fetcher,
  FetchValidators,
} from "./types";

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type ExternalTransportRequest = {
  url: URL;
  headers: Readonly<Record<string, string>>;
  resolvedAddresses: readonly ResolvedAddress[];
  signal: AbortSignal;
};

export type ExternalTransportResponse = {
  status: number;
  headers: Readonly<Record<string, string | undefined>>;
  body: AsyncIterable<Uint8Array>;
};

export type ResolveHostname = (
  hostname: string,
) => Promise<readonly ResolvedAddress[]>;

export type ExternalFetchTransport = (
  input: ExternalTransportRequest,
) => Promise<ExternalTransportResponse>;

type ExternalFetcherDependencies = {
  resolveHostname?: ResolveHostname;
  transport?: ExternalFetchTransport;
};

const maxRedirects = 3;
const maxResponseSizeBytes = 5 * 1024 * 1024;
const requestTimeoutMs = 15_000;
const soundCityUserAgent = "Sound City Scheduled Refresh/1.0";
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export class ExternalFetchError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unsafe-destination"
      | "redirect-limit"
      | "response-too-large"
      | "timeout",
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ExternalFetchError";
  }
}

const nonPublicIpv4 = new BlockList();
nonPublicIpv4.addSubnet("0.0.0.0", 8, "ipv4");
nonPublicIpv4.addSubnet("10.0.0.0", 8, "ipv4");
nonPublicIpv4.addSubnet("100.64.0.0", 10, "ipv4");
nonPublicIpv4.addSubnet("127.0.0.0", 8, "ipv4");
nonPublicIpv4.addSubnet("169.254.0.0", 16, "ipv4");
nonPublicIpv4.addSubnet("172.16.0.0", 12, "ipv4");
nonPublicIpv4.addSubnet("192.0.0.0", 24, "ipv4");
nonPublicIpv4.addSubnet("192.0.2.0", 24, "ipv4");
nonPublicIpv4.addSubnet("192.88.99.0", 24, "ipv4");
nonPublicIpv4.addSubnet("192.168.0.0", 16, "ipv4");
nonPublicIpv4.addSubnet("198.18.0.0", 15, "ipv4");
nonPublicIpv4.addSubnet("198.51.100.0", 24, "ipv4");
nonPublicIpv4.addSubnet("203.0.113.0", 24, "ipv4");
nonPublicIpv4.addSubnet("224.0.0.0", 4, "ipv4");
nonPublicIpv4.addSubnet("240.0.0.0", 4, "ipv4");

const nonPublicIpv6 = new BlockList();
nonPublicIpv6.addAddress("::", "ipv6");
nonPublicIpv6.addAddress("::1", "ipv6");
nonPublicIpv6.addSubnet("::ffff:0:0", 96, "ipv6");
nonPublicIpv6.addSubnet("100::", 64, "ipv6");
nonPublicIpv6.addSubnet("2001::", 32, "ipv6");
nonPublicIpv6.addSubnet("2001:db8::", 32, "ipv6");
nonPublicIpv6.addSubnet("2002::", 16, "ipv6");
nonPublicIpv6.addSubnet("fc00::", 7, "ipv6");
nonPublicIpv6.addSubnet("fe80::", 10, "ipv6");
nonPublicIpv6.addSubnet("ff00::", 8, "ipv6");

const globalUnicastIpv6 = new BlockList();
globalUnicastIpv6.addSubnet("2000::", 3, "ipv6");

function unsafeDestination(reason: string): never {
  throw new ExternalFetchError(
    `Unsafe external fetch destination: ${reason}`,
    "unsafe-destination",
  );
}

function withoutIpv6Brackets(hostname: string) {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

function assertPublicAddress(address: ResolvedAddress) {
  const family = isIP(address.address);
  if (family !== address.family) {
    unsafeDestination(`invalid resolved address ${address.address}`);
  }
  if (
    (family === 4 && nonPublicIpv4.check(address.address, "ipv4")) ||
    (family === 6 &&
      (!globalUnicastIpv6.check(address.address, "ipv6") ||
        nonPublicIpv6.check(address.address, "ipv6")))
  ) {
    unsafeDestination(`non-public address ${address.address}`);
  }
}

async function defaultResolveHostname(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  const addresses = await dnsLookup(hostname, { all: true });
  return addresses.map((address) => {
    if (address.family !== 4 && address.family !== 6) {
      unsafeDestination(`invalid address family for ${address.address}`);
    }
    const family: 4 | 6 = address.family;
    return {
      address: address.address,
      family,
    };
  });
}

async function resolvePublicAddresses(
  url: URL,
  resolveHostname: ResolveHostname,
) {
  const hostname = withoutIpv6Brackets(url.hostname);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily as 4 | 6 }]
    : await resolveHostname(hostname);

  if (addresses.length === 0) {
    unsafeDestination(`no addresses resolved for ${hostname}`);
  }
  for (const address of addresses) {
    assertPublicAddress(address);
  }
  return addresses;
}

function parseDestination(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    unsafeDestination("invalid URL");
  }

  if (url.protocol !== "https:") {
    unsafeDestination("only HTTPS is permitted");
  }
  if (url.username || url.password) {
    unsafeDestination("embedded credentials are not permitted");
  }
  return url;
}

function pinnedLookup(addresses: readonly ResolvedAddress[]): LookupFunction {
  return (_hostname, options, callback) => {
    const matchingAddresses = options.family
      ? addresses.filter((address) => address.family === options.family)
      : [...addresses];
    if (matchingAddresses.length === 0) {
      const error = Object.assign(
        new Error("No validated address matches the requested family"),
        { code: "ENOTFOUND" },
      );
      callback(error, "", 0);
      return;
    }
    if (options.all) {
      callback(null, matchingAddresses);
      return;
    }
    const [address] = matchingAddresses;
    callback(null, address.address, address.family);
  };
}

function normalizedHeaders(
  headers: Readonly<Record<string, string | string[] | undefined>>,
) {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name.toLowerCase(),
      Array.isArray(value) ? value.join(", ") : value,
    ]),
  );
}

const nodeHttpsTransport: ExternalFetchTransport = async (input) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(
      input.url,
      {
        method: "GET",
        headers: input.headers,
        lookup: pinnedLookup(input.resolvedAddresses),
        signal: input.signal,
      },
      (response) => {
        resolve({
          status: response.statusCode ?? 0,
          headers: normalizedHeaders(response.headers),
          body: response,
        });
      },
    );
    request.on("error", reject);
    request.end();
  });

function responseTooLarge(): never {
  throw new ExternalFetchError(
    `External fetch response exceeded ${maxResponseSizeBytes} bytes`,
    "response-too-large",
  );
}

async function readBody(
  body: AsyncIterable<Uint8Array>,
  contentLength: string | undefined,
) {
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxResponseSizeBytes) {
      responseTooLarge();
    }
  }
  const chunks: Buffer[] = [];
  let responseSizeBytes = 0;
  for await (const chunk of body) {
    const buffer = Buffer.from(chunk);
    responseSizeBytes += buffer.byteLength;
    if (responseSizeBytes > maxResponseSizeBytes) {
      responseTooLarge();
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function requestWithTimeout(
  url: URL,
  validators: FetchValidators,
  resolveHostname: ResolveHostname,
  transport: ExternalFetchTransport,
) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => {
      const error = new ExternalFetchError(
        `External fetch timed out after ${requestTimeoutMs}ms`,
        "timeout",
        true,
      );
      reject(error);
      controller.abort(error);
    }, requestTimeoutMs);
  });
  const requested = (async () => {
    try {
      const resolvedAddresses = await resolvePublicAddresses(
        url,
        resolveHostname,
      );
      controller.signal.throwIfAborted();
      const response = await transport({
        url,
        headers: {
          accept: "*/*",
          "user-agent": soundCityUserAgent,
          ...(validators.etag
            ? { "if-none-match": validators.etag }
            : {}),
          ...(validators.lastModified
            ? { "if-modified-since": validators.lastModified }
            : {}),
        },
        resolvedAddresses,
        signal: controller.signal,
      });
      return {
        response,
        body: await readBody(
          response.body,
          header(response.headers, "content-length"),
        ),
      };
    } catch (error) {
      controller.abort(error);
      throw error;
    }
  })();

  try {
    return await Promise.race([requested, timedOut]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function header(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
) {
  return Object.entries(headers).find(
    ([candidate]) => candidate.toLowerCase() === name.toLowerCase(),
  )?.[1];
}

function withFailureTelemetry(
  error: unknown,
  telemetry: FetchFailureTelemetry,
): FetchFailure {
  const failure: FetchFailure =
    error instanceof Error
      ? error
      : new Error("External fetch failed", { cause: error });
  failure.fetchTelemetry = {
    ...failure.fetchTelemetry,
    ...telemetry,
  };
  return failure;
}

export function createExternalFetcher(
  dependencies: ExternalFetcherDependencies = {},
): Fetcher {
  const resolveHostname =
    dependencies.resolveHostname ?? defaultResolveHostname;
  const transport = dependencies.transport ?? nodeHttpsTransport;

  const fetchOnce = async (
    rawUrl: string,
    validators: FetchValidators,
  ) => {
    let url = parseDestination(rawUrl);

    for (let redirectCount = 0; ; redirectCount += 1) {
      let requested;
      try {
        requested = await requestWithTimeout(
          url,
          validators,
          resolveHostname,
          transport,
        );
      } catch (error) {
        throw withFailureTelemetry(error, { finalUrl: url.toString() });
      }
      const { response, body } = requested;
      const location = header(response.headers, "location");

      if (redirectStatuses.has(response.status) && location) {
        if (redirectCount >= maxRedirects) {
          throw new ExternalFetchError(
            `External fetch exceeded ${maxRedirects} redirects`,
            "redirect-limit",
          );
        }
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, url);
        } catch {
          unsafeDestination("invalid redirect URL");
        }
        url = parseDestination(redirectUrl.toString());
        continue;
      }

      return {
        body: body.toString("utf8"),
        contentType: header(response.headers, "content-type") ?? "",
        status: response.status,
        etag: header(response.headers, "etag"),
        lastModified: header(response.headers, "last-modified"),
        responseSizeBytes: body.byteLength,
        retryCount: 0,
        finalUrl: url.toString(),
      };
    }
  };

  const retryOnce = async (
    rawUrl: string,
    validators: FetchValidators,
  ) => {
    try {
      const retried = await fetchOnce(rawUrl, validators);
      return { ...retried, retryCount: 1 };
    } catch (retryError) {
      throw withFailureTelemetry(retryError, { retryCount: 1 });
    }
  };

  return async (rawUrl, validators = {}) => {
    let result;
    try {
      result = await fetchOnce(rawUrl, validators);
    } catch (error) {
      if (error instanceof ExternalFetchError && !error.retryable) {
        throw error;
      }
      return retryOnce(rawUrl, validators);
    }
    if (
      result.status === 429 ||
      (result.status >= 500 && result.status <= 599)
    ) {
      return retryOnce(rawUrl, validators);
    }
    return result;
  };
}

export const externalFetcher = createExternalFetcher();
