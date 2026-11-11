import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("../../docs/index.html", import.meta.url), "utf8");

test("product manual has one self-contained inline JavaScript program that parses", () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, "manual should contain exactly one inline script");
  assert.doesNotThrow(() => new Script(scripts[0][1], { filename: "docs/index.html" }));
  assert.doesNotMatch(html, /<script\s+src=/i, "manual must not load JavaScript dependencies");
});

test("manual exposes the actual repository API endpoints and embeds cleanly", () => {
  assert.match(html, /window\.self\s*!==\s*window\.top/);
  assert.match(html, /apiBase\+"\/releases\/latest"/);
  assert.match(html, /getJSON\(apiBase\)/);
  assert.match(html, /commits\?per_page=1/);
  assert.match(html, /is-embedded/);
});

test("simulation models the real archive path, issue fields, activity markers and JSON schema", () => {
  assert.match(html, /logs\/"\+year\+"\/"\+month\+"\/"\+input\.date\+"\.md/);
  for (const field of ["Shipped", "Learned", "Blockers", "Tomorrow"]) {
    assert.ok(html.includes('"' + field + '"'), "missing issue field: " + field);
  }
  assert.match(html, /ACTIVITY:START/);
  assert.match(html, /schema_version:1/);
  assert.match(html, /no false empty-activity result is written/i);
});
