import {
  call,
  getClient,
  intFlag,
  objectTitle,
  parseArgs,
  propertyValue,
  shortDate,
  truncate,
  usage,
  type Obj,
  type Truncated,
} from "../lib.js";

const BODY_PREVIEW = 1500;

export async function pageCommand(args: string[]) {
  const sub = args[0];
  const rest = args.slice(1);
  switch (sub) {
    case "view":
      return pageView(rest);
    case "create":
      return pageCreate(rest);
    case "update":
      return pageUpdate(rest);
    default:
      throw usage(
        sub ? `Unknown page subcommand "${sub}"` : "Missing page subcommand",
        "Run `notion-axi page view <id>`",
        "Run `notion-axi page create --parent <id> --title <text>`",
        "Run `notion-axi page update <id> --append <markdown>`",
      );
  }
}

async function pageView(args: string[]) {
  const { positionals, flags } = parseArgs(args, ["full"]);
  const id = positionals[0];
  if (!id) throw usage("Missing page id", "Run `notion-axi page view <id>`");
  const full = flags.full === true;

  const notion = getClient();
  const page: Obj = await call(() => notion.pages.retrieve({ page_id: id }));
  const md: Obj = await call(() => notion.pages.retrieveMarkdown({ page_id: id }));

  const properties = Object.entries(page.properties ?? {})
    .map(([name, prop]) => ({ name, type: (prop as Obj).type, value: propertyValue(prop as Obj) }))
    .filter((p) => p.value !== null && p.value !== "");

  const markdown = md.markdown ?? "";
  const view: Truncated = full
    ? { text: markdown, truncated: false }
    : truncate(markdown, BODY_PREVIEW);

  const out: Obj = {
    page: {
      id: page.id,
      title: objectTitle(page),
      url: page.url,
      edited: shortDate(page.last_edited_time),
    },
    properties,
    body: view.text || "(no text content)",
  };

  if (view.truncated || md.truncated) {
    out.body_truncated = true;
    out.body_chars_shown = view.text.length;
    if (view.total) out.body_chars_total = view.total;
    out.help = [`Run \`notion-axi page view ${id} --full\` for the complete body`];
  } else {
    out.help = [
      `Run \`notion-axi page update ${id} --append <markdown>\` to add content`,
    ];
  }
  return out;
}

async function pageCreate(args: string[]) {
  const { flags } = parseArgs(args, ["db"]);
  const parent = typeof flags.parent === "string" ? flags.parent : undefined;
  const title = typeof flags.title === "string" ? flags.title : undefined;
  if (!parent) throw usage("Missing --parent", "Run `notion-axi page create --parent <id> --title <text>`");
  if (!title) throw usage("Missing --title", "Run `notion-axi page create --parent <id> --title <text>`");

  const notion = getClient();
  let parentRef: Obj;
  let properties: Obj;

  if (flags.db === true) {
    const ds: Obj = await call(() => notion.dataSources.retrieve({ data_source_id: parent }));
    const titleProp =
      Object.keys(ds.properties ?? {}).find((k) => ds.properties[k]?.type === "title") ?? "Name";
    parentRef = { data_source_id: parent };
    properties = { [titleProp]: { title: [{ text: { content: title } }] } };
  } else {
    parentRef = { page_id: parent };
    properties = { title: { title: [{ text: { content: title } }] } };
  }

  const page: Obj = await call(() =>
    notion.pages.create({ parent: parentRef as any, properties: properties as any }),
  );

  if (typeof flags.content === "string") {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: page.id,
        type: "insert_content",
        insert_content: { content: flags.content as string, position: { type: "end" } },
      }),
    );
  }

  return {
    created: page.id,
    title,
    url: page.url,
    help: [
      `Run \`notion-axi page view ${page.id}\` to read it back`,
      `Run \`notion-axi page update ${page.id} --append <markdown>\` to add more content`,
    ],
  };
}

async function pageUpdate(args: string[]) {
  const { positionals, flags } = parseArgs(args);
  const id = positionals[0];
  if (!id) throw usage("Missing page id", "Run `notion-axi page update <id> --append <markdown>`");

  const append = typeof flags.append === "string" ? flags.append : undefined;
  const replace = typeof flags.replace === "string" ? flags.replace : undefined;
  if (append === undefined && replace === undefined) {
    throw usage(
      "Nothing to update",
      "Run `notion-axi page update <id> --append <markdown>` to append content",
      "Run `notion-axi page update <id> --replace <markdown>` to overwrite content",
    );
  }

  const notion = getClient();
  if (replace !== undefined) {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "replace_content",
        replace_content: { new_str: replace, allow_deleting_content: true },
      }),
    );
  } else {
    await call(() =>
      notion.pages.updateMarkdown({
        page_id: id,
        type: "insert_content",
        insert_content: { content: append as string, position: { type: "end" } },
      }),
    );
  }

  return {
    updated: id,
    mode: replace !== undefined ? "replace" : "append",
    help: [`Run \`notion-axi page view ${id}\` to confirm`],
  };
}
