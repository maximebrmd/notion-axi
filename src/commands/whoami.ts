import { ntnApi } from "../ntn.js";
import type { Obj } from "../format.js";

export const WHOAMI_HELP = `usage: notion-axi whoami

Show the identity behind the current Notion login — the bot/integration or
user it acts as, and the workspace it can reach.

examples:
  notion-axi whoami
`;

export async function whoamiCommand() {
  const me: Obj = await ntnApi("v1/users/me");

  const out: Obj = { id: me.id, name: me.name ?? "(unnamed)", type: me.type };
  if (me.type === "bot") {
    out.workspace = me.bot?.workspace_name ?? "";
    out.token = "ntn login (workspace) or NOTION_API_TOKEN";
  } else {
    out.email = me.person?.email ?? "";
    out.token = "personal access token";
  }
  return out;
}
