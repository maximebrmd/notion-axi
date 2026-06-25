/**
 * Loosely-typed Notion object. The Notion API's discriminated unions are
 * enormous, so command code reads the handful of fields it needs defensively.
 */
export type Obj = Record<string, any>;

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
      return prop.date
        ? [prop.date.start, prop.date.end].filter(Boolean).join(" → ")
        : null;
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
