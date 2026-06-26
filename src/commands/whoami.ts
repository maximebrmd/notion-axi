import { call, getClient } from "../notion.js";
import type { Obj } from "../format.js";

export const WHOAMI_HELP = `usage: notion-axi whoami

Show the identity behind the current NOTION_TOKEN — the bot/integration or
user it acts as, and the workspace it can reach.

examples:
  notion-axi whoami
`;

export async function whoamiCommand() {
  const notion = getClient();
  const me: Obj = await call(() => notion.users.me({}));

  const out: Obj = { id: me.id, name: me.name ?? "(unnamed)", type: me.type };
  if (me.type === "bot") {
    out.workspace = me.bot?.workspace_name ?? "";
    out.token = "internal integration or PAT";
  } else {
    out.email = me.person?.email ?? "";
    out.token = "personal access token";
  }
  return out;
}
