import test from "node:test";
import assert from "node:assert/strict";
import { replaceMarkdownSection } from "../lib/markdown.mjs";

test("updates an existing template section without duplicating its heading", () => {
  const source = "# Daily Log\n\n## Shipped\n- \n\n## Learned\n- \n";
  const result = replaceMarkdownSection(source, "Shipped", "- Delivered the capture fix.");

  assert.equal((result.match(/^## Shipped$/gm) ?? []).length, 1);
  assert.match(result, /## Shipped\n- Delivered the capture fix\.\n\n## Learned/);
});

test("keeps later sections and activity markers outside the replaced section", () => {
  const source = [
    "# Daily Log",
    "",
    "## Tomorrow",
    "- ",
    "",
    "<!-- ACTIVITY:START -->",
    "## Shipped Today (GitHub activity)",
    "old activity",
    "<!-- ACTIVITY:END -->",
    "",
    "---",
    "",
  ].join("\n");
  const result = replaceMarkdownSection(source, "Tomorrow", "- Review the PR.");

  assert.match(result, /## Tomorrow\n- Review the PR\./);
  assert.match(result, /<!-- ACTIVITY:START -->[\s\S]*old activity/);
  assert.match(result, /\n---\n/);
});

test("appends a missing section using a level-two heading", () => {
  const result = replaceMarkdownSection("# Daily Log\n", "Learned", "- A lesson.");

  assert.match(result, /## Learned\n- A lesson\.\n$/);
});

test("matches headings literally rather than treating punctuation as regex syntax", () => {
  const source = "# Notes\n\n## What (I) built\n- old\n\n## Next\n- soon\n";
  const result = replaceMarkdownSection(source, "What (I) built", "- new");

  assert.match(result, /## What \(I\) built\n- new\n\n## Next/);
  assert.doesNotMatch(result, /- old/);
});
