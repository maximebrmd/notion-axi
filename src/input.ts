import { readFileSync } from "node:fs";
import { strFlag } from "./args.js";
import { usage } from "./errors.js";

/** Read explicit inline/file input. A file path of `-` consumes stdin. */
export function textInput(
  flags: Record<string, string | boolean>,
  name: string,
): string | undefined {
  if (flags[name] === true || flags[`${name}-file`] === true) {
    throw usage(`Missing value for --${name} or --${name}-file`);
  }
  const inline = strFlag(flags[name]);
  const file = strFlag(flags[`${name}-file`]);
  if (inline !== undefined && file !== undefined) {
    throw usage(`Pass only one of --${name} or --${name}-file`);
  }
  if (file === undefined) return inline;
  if (file === "-" && process.stdin.isTTY) {
    throw usage("No piped input", `Pipe content into --${name}-file -`);
  }
  try {
    return readFileSync(file === "-" ? 0 : file, "utf8");
  } catch {
    throw usage(
      `Cannot read file: ${file}`,
      `Check the input for --${name}-file`,
    );
  }
}
