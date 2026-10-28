import { truncate, type Obj } from "./format.js";

/** Keep native text and large schema/Workers responses bounded by default. */
export function boundedOutput(
  label: string,
  value: unknown,
  full: boolean,
  hint: string,
): Obj {
  if (full) return { [label]: value };
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const view = truncate(text, 6000);
  if (!view.truncated) return { [label]: value };
  return {
    [label]: view.text,
    truncated: true,
    chars_total: view.total,
    help: [hint],
  };
}
