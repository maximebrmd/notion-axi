import { call, getClient, intFlag, parseArgs, type Obj } from "../lib.js";

export async function usersCommand(args: string[]) {
  const { flags } = parseArgs(args);
  const limit = intFlag(flags.limit, 50);

  const notion = getClient();
  const res: Obj = await call(() => notion.users.list({ page_size: Math.min(limit, 100) }));

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
