import { api, getFile, putFile } from "./lib/github.mjs";

const repository = process.env.GITHUB_REPOSITORY;
const [owner, repo] = repository.split("/");
const configured = (process.env.GH_ACTIVITY_REPOS ?? "").split(/[\s,]+/).filter(Boolean);
const repositories = [...new Set([repository, ...configured])];
const until = new Date();
const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
const date = until.toISOString().slice(0, 10);
const [year, month] = date.split("-");
const path = `logs/${year}/${month}/${date}.md`;
const entry = await getFile(path);
if (!entry) throw new Error(`Daily entry does not exist: ${path}`);

const sections = [];
for (const fullName of repositories) {
  const [repoOwner, repoName] = fullName.split("/");
  if (!repoOwner || !repoName) {
    console.warn(`Skipping invalid repository setting: ${fullName}`);
    continue;
  }
  try {
    const query = new URLSearchParams({ since: since.toISOString(), until: until.toISOString(), per_page: "100" });
    const [commits, pulls, releases] = await Promise.all([
      api(`/repos/${repoOwner}/${repoName}/commits?${query}`),
      api(`/repos/${repoOwner}/${repoName}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
      api(`/repos/${repoOwner}/${repoName}/releases?per_page=100`),
    ]);
    const recentCommits = commits.filter((item) => {
      const authored = item.commit?.author?.date;
      return authored && authored >= since.toISOString() && authored <= until.toISOString();
    });
    const recentPulls = pulls.filter((item) => item.merged_at && item.merged_at >= since.toISOString() && item.merged_at <= until.toISOString());
    const recentReleases = releases.filter((item) => item.published_at && item.published_at >= since.toISOString() && item.published_at <= until.toISOString());
    for (const item of recentCommits) {
      const message = item.commit.message.split("\n")[0].replaceAll("\r", "");
      const isLogNote = /\\[log\\]/i.test(message);
      const category = isLogNote ? " log note" : "";
      sections.push(`- **${fullName}${category}** — [${escapeMarkdown(message)}](${item.html_url})`);
    }
    for (const item of recentPulls) sections.push(`- **${fullName} PR** — [#${item.number} ${escapeMarkdown(item.title)}](${item.html_url})`);
    for (const item of recentReleases) sections.push(`- **${fullName} release** — [${escapeMarkdown(item.name || item.tag_name)}](${item.html_url})`);
  } catch (error) {
    console.warn(`Activity unavailable for ${fullName}: ${error.message}`);
  }
}

const activity = sections.length ? sections.join("\n") : "_No GitHub commits, merged pull requests, or releases found in the last 24 hours._";
const start = "<!-- ACTIVITY:START -->";
const end = "<!-- ACTIVITY:END -->";
const block = `${start}\n### Shipped Today (GitHub activity)\n${activity}\n${end}`;
let content = entry.content;
const pattern = /<!-- ACTIVITY:START -->[\s\S]*?<!-- ACTIVITY:END -->/;
if (pattern.test(content)) content = content.replace(pattern, block);
else content = `${content.trimEnd()}\n\n${block}\n`;
await putFile(path, content, `chore(log): enrich ${date} with GitHub activity`, entry.sha);
console.log(`Recorded ${sections.length} activity item(s) from ${repositories.length} repository/repositories.`);

function escapeMarkdown(value) {
  return String(value).replaceAll("[", "\\[").replaceAll("]", "\\]").replaceAll("|", "\\|");
}
