export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Parse `<positionals...> [--flag value | --flag=value | --bool]`.
 * Names listed in `booleans` never consume the following token.
 */
export function parseArgs(args: string[], booleans: string[] = []): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const body = arg.slice(2);
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
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

/** Read a string flag, or undefined when absent / boolean. */
export function strFlag(
  value: string | boolean | undefined,
): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** Parse an integer flag, falling back when absent or invalid. */
export function intFlag(
  value: string | boolean | undefined,
  fallback: number,
): number {
  if (typeof value !== "string") return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Collect every value of a repeatable flag (`--set a=1 --set b=2`) from raw args. */
export function collectFlag(args: string[], name: string): string[] {
  const flag = `--${name}`;
  const eq = `${flag}=`;
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag && i + 1 < args.length) {
      out.push(args[++i]);
    } else if (args[i].startsWith(eq)) {
      out.push(args[i].slice(eq.length));
    }
  }
  return out;
}

/** Parse a comma-separated `--fields a,b,c` flag into a trimmed, non-empty list. */
export function listFlag(value: string | boolean | undefined): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
