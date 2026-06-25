import { Client, APIErrorCode, isNotionClientError } from "@notionhq/client";
import { AxiError } from "axi-sdk-js";

/** Loosely-typed Notion object — the API's discriminated unions are enormous,
 * so command code reads the handful of fields it needs defensively. */
export type Obj = Record<string, any>;

// ----- argument parsing -------------------------------------------------------

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/** Parse `<positionals...> [--flag value | --flag=value | --bool]`.
 * Names listed in `booleans` never consume the following token. */
export function parseArgs(args: string[], booleans: string[] = []): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const body = a.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else if (booleans.includes(body)) {
        flags[body] = true;
      } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
        flags[body] = args[++i];
      } else {
        flags[body] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

export function intFlag(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// ----- formatting -------------------------------------------------------------

export function richTextToPlain(rt: unknown): string {
  if (!Array.isArray(rt)) return "";
  return rt.map((t: Obj) => t?.plain_text ?? t?.text?.content ?? "").join("");
}

/** Best-effort human title for a page, database, or data_source object. */
export function objectTitle(obj: Obj): string {
  if (!obj) return "(untitled)";
  if (obj.object === "data_source" || obj.object === "database") {
    return richTextToPlain(obj.title) || "(untitled)";
  }
  const props: Obj = obj.properties ?? {};
  for (const key of Object.keys(props)) {
    if (props[key]?.type === "title") {
      return richTextToPlain(props[key].title) || "(untitled)";
    }
  }
  return "(untitled)";
}

export function shortDate(iso?: string): string {
  return iso ? iso.slice(0, 10) : "";
}

export interface Truncated {
  text: string;
  truncated: boolean;
  total?: number;
}

export function truncate(text: string, max: number): Truncated {
  if (text.length <= max) return { text, truncated: false };
  return { text: text.slice(0, max), truncated: true, total: text.length };
}

/** Reduce a Notion property value to a compact scalar for table output. */
export function propertyValue(prop: Obj): string | number | boolean | null {
  if (!prop) return null;
  switch (prop.type) {
    case "title":
    case "rich_text":
      return richTextToPlain(prop[prop.type]);
    case "number":
      return prop.number ?? null;
    case "select":
      return prop.select?.name ?? null;
    case "status":
      return prop.status?.name ?? null;
    case "multi_select":
      return (prop.multi_select ?? []).map((s: Obj) => s.name).join(", ");
    case "people":
      return (prop.people ?? []).map((p: Obj) => p.name ?? p.id).join(", ");
    case "date":
      return prop.date ? [prop.date.start, prop.date.end].filter(Boolean).join(" → ") : null;
    case "checkbox":
      return prop.checkbox ?? false;
    case "url":
      return prop.url ?? null;
    case "email":
      return prop.email ?? null;
    case "phone_number":
      return prop.phone_number ?? null;
    case "formula":
      return prop.formula?.[prop.formula?.type] ?? null;
    case "relation":
      return (prop.relation ?? []).length;
    case "rollup":
      return prop.rollup?.number ?? prop.rollup?.type ?? null;
    case "created_time":
      return shortDate(prop.created_time);
    case "last_edited_time":
      return shortDate(prop.last_edited_time);
    case "created_by":
      return prop.created_by?.name ?? prop.created_by?.id ?? null;
    case "last_edited_by":
      return prop.last_edited_by?.name ?? prop.last_edited_by?.id ?? null;
    case "files":
      return (prop.files ?? []).length;
    default:
      return prop.type ?? null;
  }
}

// ----- Notion client ----------------------------------------------------------

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

/** Run a Notion API call, mapping its errors to structured AxiErrors. */
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

export function usage(message: string, ...suggestions: string[]): AxiError {
  return new AxiError(message, "VALIDATION_ERROR", suggestions);
}
