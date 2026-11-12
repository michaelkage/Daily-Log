import test from "node:test";
import assert from "node:assert/strict";
import {
  collectRepositoryActivity,
  discoverRepositories,
  parseRepositoryList,
  renderActivityBlock,
} from "../lib/activity.mjs";

const since = new Date("2026-11-10T00:00:00.000Z");
const until = new Date("2026-11-11T00:00:00.000Z");

test("repository list accepts commas and newlines and removes duplicates", () => {
  assert.deepEqual(parseRepositoryList("a/one, b/two\na/one"), ["a/one", "b/two"]);
});

test("account discovery paginates and combines discovered and configured repositories", async () => {
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    if (new URL("https://example.test" + path).searchParams.get("page") === "1") return Array.from({ length: 100 }, (_, i) => ({ full_name: "owner/repo-" + i }));
    return [{ full_name: "owner/last" }];
  };
  const repos = await discoverRepositories(api, "owner/daily-log", ["owner/extra"], true);
  assert.equal(calls.length, 2);
  assert.equal(repos.length, 102);
  assert.ok(!repos.includes("owner/daily-log"));
  assert.ok(repos.includes("owner/last"));
  assert.ok(repos.includes("owner/extra"));
});

test("missing account token and empty configuration produce a safe no-op repository set", async () => {
  let called = false;
  const repos = await discoverRepositories(async () => {
    called = true;
    throw new Error("Account discovery must not run without an account token.");
  }, "owner/daily-log", [], false);
  assert.deepEqual(repos, []);
  assert.equal(called, false);
});

test("repositories without commits are skipped without requesting other details", async () => {
  const calls = [];
  const api = async (path) => { calls.push(path); return []; };
  const result = await collectRepositoryActivity(api, "owner/quiet", since, until);
  assert.equal(result, null);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /\/commits\?/);
});

test("active repository captures commit details and related merged PRs and releases", async () => {
  const api = async (path) => {
    if (path.includes("/commits?")) return [{
      sha: "abcdef123456",
      html_url: "https://github.com/owner/app/commit/abcdef",
      commit: { message: "Ship feature", author: { name: "Dev", date: "2026-11-10T12:00:00Z" } },
    }];
    if (path === "/repos/owner/app") return {
      description: "A useful app", language: "JavaScript", default_branch: "main", html_url: "https://github.com/owner/app",
    };
    if (path.includes("/pulls?")) return [{
      number: 4, title: "Feature PR", html_url: "https://github.com/owner/app/pull/4", merged_at: "2026-11-10T13:00:00Z",
    }];
    if (path.includes("/releases?")) return [{
      name: "v1.0", tag_name: "v1.0", html_url: "https://github.com/owner/app/releases/tag/v1.0", published_at: "2026-11-10T14:00:00Z",
    }];
    throw new Error("Unexpected request " + path);
  };
  const result = await collectRepositoryActivity(api, "owner/app", since, until);
  assert.equal(result.commits.length, 1);
  assert.equal(result.commits[0].sha, "abcdef1");
  assert.equal(result.pulls.length, 1);
  assert.equal(result.releases.length, 1);
  const markdown = renderActivityBlock([result]);
  assert.match(markdown, /owner\/app/);
  assert.match(markdown, /Ship feature/);
  assert.match(markdown, /Feature PR/);
  assert.match(markdown, /v1\.0/);
});

test("empty activity says no repositories had commits and reports scan failures", () => {
  const markdown = renderActivityBlock([], [{ repository: "owner/private", reason: "403 denied" }]);
  assert.match(markdown, /No repositories had commits/);
  assert.match(markdown, /owner\/private/);
});
