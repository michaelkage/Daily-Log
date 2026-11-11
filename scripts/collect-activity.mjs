import { activityApi as api, getFile, putFile } from "./lib/github.mjs";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error("GITHUB_REPOSITORY must be in owner/repository format.");
}
const configured = (process.env.GH_ACTIVITY_REPOS ?? "").split(/[\s,]+/).filter(Boolean);
const repositories = [...new Set([repository, ...configured])];
const until = new Date();
const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
const date = until.toISOString().slice(0, 10);
const [year, month] = date.split("-");
const path = "logs/" + year + "/" + month + "/" + date + ".md";
const entry = await getFile(path);
if (!entry) throw new Error("Daily entry does not exist: " + path);

const sections = [];
const failures = [];
let completedRepositories = 0;

for (const fullName of repositories) {
  if (!/^[^/]+\/[^/]+$/.test(fullName)) {
    failures.push({ repository: fullName, reason: "invalid owner/repository setting" });
    console.warn("Skipping invalid repository setting: " + fullName);
    continue;
  }

  const [repoOwner, repoName] = fullName.split("/");
  try {
    const query = new URLSearchParams({
      since: since.toISOString(),
      until: until.toISOString(),
      per_page: "100",
    });
    const [commits, pulls, releases] = await Promise.all([
      api("/repos/" + repoOwner + "/" + repoName + "/commits?" + query),
      api("/repos/" + repoOwner + "/" + repoName + "/pulls?state=closed&sort=updated&direction=desc&per_page=100"),
      api("/repos/" + repoOwner + "/" + repoName + "/releases?per_page=100"),
    ]);

    completedRepositories += 1;
    const recentCommits = commits.filter((item) => {
      const authored = item.commit?.author?.date ?? item.commit?.committer?.date;
      return authored && authored >= since.toISOString() && authored <= until.toISOString();
    });
    const recentPulls = pulls.filter((item) =>
      item.merged_at && item.merged_at >= since.toISOString() && item.merged_at <= until.toISOString()
    );
    const recentReleases = releases.filter((item) =>
      item.published_at && item.published_at >= since.toISOString() && item.published_at <= until.toISOString()
    );

    for (const item of recentCommits) {
      const message = item.commit.message.split("\n")[0].replaceAll("\r", "");
      const isLogNote = /\[log\]/i.test(message);
      const category = isLogNote ? " log note" : "";
      sections.push("- **" + fullName + category + "** — [" + escapeMarkdown(message) + "](" + item.html_url + ")");
    }
    for (const item of recentPulls) {
      sections.push("- **" + fullName + " PR** — [#" + item.number + " " + escapeMarkdown(item.title) + "](" + item.html_url + ")");
    }
    for (const item of recentReleases) {
      sections.push("- **" + fullName + " release** — [" + escapeMarkdown(item.name || item.tag_name) + "](" + item.html_url + ")");
    }
  } catch (error) {
    const reason = String(error?.message ?? error).split("\n")[0].slice(0, 240);
    failures.push({ repository: fullName, reason });
    console.warn("Activity unavailable for " + fullName + ": " + reason);
  }
}

if (completedRepositories === 0) {
  throw new Error(
    "Activity collection failed for every configured repository; preserving the existing activity block. " +
    failures.map((item) => item.repository + ": " + item.reason).join("; ")
  );
}

let activity = sections.length
  ? sections.join("\n")
  : failures.length
    ? "_No activity found in repositories checked successfully._"
    : "_No GitHub commits, merged pull requests, or releases found in the last 24 hours._";
if (failures.length) {
  activity += "\n\n> ⚠️ Incomplete activity collection for: " +
    failures.map((item) => escapeMarkdown(item.repository) + " (" + escapeMarkdown(item.reason) + ")").join("; ");
}

const start = "<!-- ACTIVITY:START -->";
const end = "<!-- ACTIVITY:END -->";
const block = start + "\n## Shipped Today (GitHub activity)\n" + activity + "\n" + end;
const pattern = /<!-- ACTIVITY:START -->[\s\S]*?<!-- ACTIVITY:END -->/;
let content = entry.content;
if (pattern.test(content)) content = content.replace(pattern, block);
else content = content.trimEnd() + "\n\n" + block + "\n";

await putFile(path, content, "chore(log): enrich " + date + " with GitHub activity", entry.sha);
console.log(
  "Recorded " + sections.length + " activity item(s) across " + completedRepositories +
  " successfully checked repository/repositories; " + failures.length + " failure(s)."
);

function escapeMarkdown(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("|", "\\|");
}
