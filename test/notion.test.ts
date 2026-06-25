import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@notionhq/client", () => ({
  Client: class {
    auth: unknown;
    constructor(opts: { auth: unknown }) {
      this.auth = opts.auth;
    }
  },
  APIErrorCode: {
    Unauthorized: "unauthorized",
    ObjectNotFound: "object_not_found",
  },
  isNotionClientError: vi.fn(),
}));

import { isNotionClientError } from "@notionhq/client";
import { AxiError } from "../src/errors.js";
import { call, getClient, hasToken } from "../src/notion.js";

const notionError = (code: string | undefined, message = "boom") =>
  Object.assign(new Error(message), { code });

describe("getClient / hasToken", () => {
  let token: string | undefined;
  let apiKey: string | undefined;
  beforeEach(() => {
    token = process.env.NOTION_TOKEN;
    apiKey = process.env.NOTION_API_KEY;
    delete process.env.NOTION_TOKEN;
    delete process.env.NOTION_API_KEY;
  });
  afterEach(() => {
    if (token !== undefined) process.env.NOTION_TOKEN = token;
    else delete process.env.NOTION_TOKEN;
    if (apiKey !== undefined) process.env.NOTION_API_KEY = apiKey;
    else delete process.env.NOTION_API_KEY;
  });

  it("throws AUTH_REQUIRED when no token is set", () => {
    expect(hasToken()).toBe(false);
    try {
      getClient();
      throw new Error("expected getClient to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AxiError);
      expect((e as AxiError).code).toBe("AUTH_REQUIRED");
      expect((e as AxiError).suggestions.length).toBeGreaterThan(0);
    }
  });

  it("builds a client from NOTION_TOKEN", () => {
    process.env.NOTION_TOKEN = "ntn_abc";
    expect(hasToken()).toBe(true);
    expect((getClient() as unknown as { auth: string }).auth).toBe("ntn_abc");
  });

  it("falls back to NOTION_API_KEY", () => {
    process.env.NOTION_API_KEY = "ntn_legacy";
    expect((getClient() as unknown as { auth: string }).auth).toBe(
      "ntn_legacy",
    );
  });
});

describe("call — error translation", () => {
  beforeEach(() => vi.mocked(isNotionClientError).mockReset());

  it("returns the resolved value on success", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(false);
    await expect(call(async () => 42)).resolves.toBe(42);
  });

  it("maps Unauthorized with a token hint", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(true);
    const err = await call(async () => {
      throw notionError("unauthorized", "no");
    }).catch((e) => e);
    expect(err).toBeInstanceOf(AxiError);
    expect(err.code).toBe("UNAUTHORIZED");
    expect(err.suggestions.join(" ")).toMatch(/integration secret/i);
  });

  it("maps ObjectNotFound with a sharing hint", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(true);
    const err = await call(async () => {
      throw notionError("object_not_found");
    }).catch((e) => e);
    expect(err.code).toBe("OBJECT_NOT_FOUND");
    expect(err.suggestions.join(" ")).toMatch(/Connections/);
  });

  it("maps other Notion error codes with no suggestions", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(true);
    const err = await call(async () => {
      throw notionError("conflict");
    }).catch((e) => e);
    expect(err.code).toBe("CONFLICT");
    expect(err.suggestions).toEqual([]);
  });

  it("defaults code and message when the Notion error lacks them", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(true);
    const err = await call(async () => {
      throw Object.assign(new Error(""), { message: undefined });
    }).catch((e) => e);
    expect(err.code).toBe("NOTION_ERROR");
    expect(err.message).toBe("Notion API error");
  });

  it("rethrows non-Notion errors untouched", async () => {
    vi.mocked(isNotionClientError).mockReturnValue(false);
    const original = new Error("network down");
    const err = await call(async () => {
      throw original;
    }).catch((e) => e);
    expect(err).toBe(original);
    expect(err).not.toBeInstanceOf(AxiError);
  });
});
