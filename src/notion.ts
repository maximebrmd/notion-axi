import { APIErrorCode, Client, isNotionClientError } from "@notionhq/client";
import { AxiError } from "./errors.js";
import type { Obj } from "./format.js";

/** Build a Notion client from NOTION_TOKEN, or fail with setup guidance. */
export function getClient(): Client {
  const token = process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY;
  if (!token) {
    throw new AxiError("NOTION_TOKEN is not set", "AUTH_REQUIRED", [
      "Create an internal integration: https://www.notion.so/my-integrations",
      "Copy the Internal Integration Secret, then: export NOTION_TOKEN=ntn_...",
      "Share each page/database with the integration via its ••• menu → Connections",
    ]);
  }
  return new Client({ auth: token });
}

export function hasToken(): boolean {
  return Boolean(process.env.NOTION_TOKEN ?? process.env.NOTION_API_KEY);
}

/** Run a Notion API call, translating its errors into structured AxiErrors. */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e: unknown) {
    if (isNotionClientError(e)) {
      const err = e as Obj;
      const code = String(err.code ?? "NOTION_ERROR").toUpperCase();
      const suggestions: string[] = [];
      if (err.code === APIErrorCode.Unauthorized) {
        suggestions.push("Check NOTION_TOKEN is a valid integration secret");
      }
      if (err.code === APIErrorCode.ObjectNotFound) {
        suggestions.push(
          "The object may not be shared with your integration — open it in Notion → ••• → Connections → add your integration",
        );
      }
      throw new AxiError(err.message ?? "Notion API error", code, suggestions);
    }
    throw e;
  }
}
