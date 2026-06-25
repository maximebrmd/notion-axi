import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createSkillMarkdown, SKILL_NAME } from "../src/skill.js";

describe("createSkillMarkdown", () => {
  it("emits valid skill frontmatter", () => {
    const md = createSkillMarkdown();
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain(`name: ${SKILL_NAME}`);
    expect(md).toContain("user-invocable: false");
    expect(md).toContain("npx -y notion-axi");
  });

  it("matches the committed skills/notion-axi/SKILL.md (run `pnpm run build:skill`)", () => {
    const target = fileURLToPath(
      new URL("../skills/notion-axi/SKILL.md", import.meta.url),
    );
    expect(readFileSync(target, "utf8")).toBe(createSkillMarkdown());
  });
});
