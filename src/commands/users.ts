import { intFlag, parseArgs } from "../args.js";
import { usage } from "../errors.js";
import { call, getClient } from "../notion.js";
import type { Obj } from "../format.js";

export const USERS_HELP = `usage: notion-axi users [--limit <n>]
       notion-axi users get <user_id>

List users visible to the integration, or get one by id (id, name, type, email).

examples:
  notion-axi users
  notion-axi users --limit 100
  notion-axi users get 1f0a...
`;

function shape(u: Obj) {
  return {
    id: u.id,
    name: u.name ?? "(unnamed)",
    type: u.type,
    email: u.person?.email ?? "",
  };
}

export async function usersCommand(args: string[]) {
  if (args[0] === "get") return usersGet(args.slice(1));
  return usersList(args);
}

async function usersList(args: string[]) {
  const { flags } = parseArgs(args);
  const limit = intFlag(flags.limit, 50);

  const notion = getClient();
  const res: Obj = await call(() =>
    notion.users.list({ page_size: Math.min(limit, 100) }),
  );
  const users = (res.results ?? []).slice(0, limit).map(shape);

  if (users.length === 0) {
    return { users: [], result: "0 users visible to this integration" };
  }
  return { users, count: users.length, has_more: res.has_more ?? false };
}

async function usersGet(args: string[]) {
  const { positionals } = parseArgs(args);
  const id = positionals[0];
  if (!id)
    throw usage("Missing user id", "Run `notion-axi users get <user_id>`");

  const notion = getClient();
  const user: Obj = await call(() => notion.users.retrieve({ user_id: id }));
  return { user: shape(user) };
}
