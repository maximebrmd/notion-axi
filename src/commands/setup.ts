import { installSessionStartHooks } from "axi-sdk-js";
import { usage } from "../lib.js";

export async function setupCommand(args: string[]) {
  if (args[0] !== "hooks") {
    throw usage(
      "Unknown setup command",
      "Run `notion-axi setup hooks` to install agent session-start hooks",
    );
  }

  installSessionStartHooks({ marker: "notion-axi", binaryNames: ["notion-axi"] });

  return {
    setup: "session-start hooks installed (or already up to date)",
    detail:
      "Claude Code / Codex / OpenCode will now run `notion-axi` at session start to inject a compact workspace view.",
    help: ["Restart your agent session for hooks to take effect"],
  };
}
