import { intFlag, parseArgs } from "../args.js";
import { call, getClient } from "../notion.js";
import type { Obj } from "../format.js";

export const USERS_HELP = `usage: notion-axi users [--limit <n>]

List users visible to the integration (id, name, type, email).

examples:
  notion-axi users
  notion-axi users --limit 100
`;

export async function usersCommand(args: string[]) {
  const { flags } = parseArgs(args);
  const limit = intFlag(flags.limit, 50);

  const notion = getClient();
  const res: Obj = await call(() =>
    notion.users.list({ page_size: Math.min(limit, 100) }),
  );

  const users = (res.results ?? []).slice(0, limit).map((u: Obj) => ({
    id: u.id,
    name: u.name ?? "(unnamed)",
    type: u.type,
    email: u.person?.email ?? "",
  }));

  if (users.length === 0) {
    return { users: [], result: "0 users visible to this integration" };
  }

  return {
    users,
    count: users.length,
    has_more: res.has_more ?? false,
  };
}
