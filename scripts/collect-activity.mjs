import { activityApi as api, getFile, putFile } from "./lib/github.mjs";
import { collectRepositoryActivity, discoverRepositories, parseRepositoryList, renderActivityBlock } from "./lib/activity.mjs";

const repository = process.env.GITHUB_REPOSITORY;
if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error("GITHUB_REPOSITORY must be in owner/repository format.");
}

const configured = parseRepositoryList(process.env.GH_ACTIVITY_REPOS);
const hasAccountToken = Boolean(process.env.GH_ACTIVITY_TOKEN);
if (!hasAccountToken && configured.length === 0) {
  console.warn(
    "GH_ACTIVITY_TOKEN is not configured. Account-wide discovery is disabled. " +
    "Add a read-only token as the GH_ACTIVITY_TOKEN Actions secret, or configure explicit repositories with GH_ACTIVITY_REPOS."
  );
}

const repositories = await discoverRepositories(api, repository, configured, hasAccountToken);
if (repositories.length === 0) {
  console.log(
    "No activity repositories are configured or discoverable. Skipping collection without modifying the daily entry. " +
    "Configure GH_ACTIVITY_TOKEN or GH_ACTIVITY_REPOS to enable project activity."
  );
  process.exit(0);
}

const until = new Date();
const since = new Date(until.getTime() - 24 * 60 * 60 * 1000);
const date = until.toISOString().slice(0, 10);
const [year, month] = date.split("-");
const path = "logs/" + year + "/" + month + "/" + date + ".md";
const entry = await getFile(path);
if (!entry) throw new Error("Daily entry does not exist: " + path);

const results = [];
const failures = [];
for (const fullName of repositories) {
  try {
    const result = await collectRepositoryActivity(api, fullName, since, until);
    if (result) results.push(result);
    else console.log("Skipping " + fullName + ": no commits in the last 24 hours.");
  } catch (error) {
    const reason = String(error?.message ?? error).split("\n")[0].slice(0, 240);
    failures.push({ repository: fullName, reason });
    console.warn("Activity unavailable for " + fullName + ": " + reason);
  }
}

if (results.length === 0 && failures.length === repositories.length) {
  throw new Error(
    "Activity collection failed for every discovered repository; preserving the existing activity block. " +
    failures.map((item) => item.repository + ": " + item.reason).join("; ")
  );
}

const block = renderActivityBlock(results, failures);
const pattern = /<!-- ACTIVITY:START -->[\s\S]*?<!-- ACTIVITY:END -->/;
let content = entry.content;
if (pattern.test(content)) content = content.replace(pattern, block);
else content = content.trimEnd() + "\n\n" + block + "\n";

await putFile(path, content, "chore(log): enrich " + date + " with repository activity", entry.sha);
console.log(
  "Recorded " + results.length + " active repository/repositories; skipped " +
  (repositories.length - results.length - failures.length) + " with no commits; " +
  failures.length + " scan failure(s)."
);
