const REPOSITORY_PATTERN = /^[^/]+\/[^/]+$/;

export function parseRepositoryList(value = "") {
  return [...new Set(String(value).split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

export async function discoverRepositories(api, currentRepository, configuredRepositories = [], discoverAccount = false) {
  const discovered = [];
  if (discoverAccount) {
    for (let page = 1; ; page += 1) {
      const params = new URLSearchParams({
        visibility: "all",
        affiliation: "owner,collaborator,organization_member",
        per_page: "100",
        page: String(page),
      });
      const batch = await api("/user/repos?" + params);
      if (!Array.isArray(batch)) throw new Error("GitHub repository discovery returned an invalid response.");
      discovered.push(...batch.map((item) => item.full_name).filter(Boolean));
      if (batch.length < 100) break;
    }
  }

  const repositories = [...new Set([currentRepository, ...discovered, ...configuredRepositories])];
  const invalid = repositories.filter((item) => !REPOSITORY_PATTERN.test(item));
  if (invalid.length) throw new Error("Invalid repository setting(s): " + invalid.join(", "));
  return repositories;
}

export async function collectRepositoryActivity(api, fullName, since, until) {
  const [owner, name] = fullName.split("/");
  const range = new URLSearchParams({
    since: since.toISOString(),
    until: until.toISOString(),
    per_page: "100",
  });
  const commits = await api("/repos/" + owner + "/" + name + "/commits?" + range);
  if (!Array.isArray(commits)) throw new Error("Commit endpoint returned an invalid response.");

  const recentCommits = commits.filter((item) => {
    const authored = item.commit?.author?.date;
    const committed = item.commit?.committer?.date;
    return [authored, committed].some((date) => date && date >= since.toISOString() && date <= until.toISOString());
  });
  // A repository is included only when it has at least one commit in the window.
  if (recentCommits.length === 0) return null;

  const [repository, pulls, releases] = await Promise.all([
    api("/repos/" + owner + "/" + name),
    api("/repos/" + owner + "/" + name + "/pulls?state=closed&sort=updated&direction=desc&per_page=100"),
    api("/repos/" + owner + "/" + name + "/releases?per_page=100"),
  ]);
  const recentPulls = (Array.isArray(pulls) ? pulls : []).filter((item) =>
    item.merged_at && item.merged_at >= since.toISOString() && item.merged_at <= until.toISOString()
  );
  const recentReleases = (Array.isArray(releases) ? releases : []).filter((item) =>
    item.published_at && item.published_at >= since.toISOString() && item.published_at <= until.toISOString()
  );

  return {
    fullName,
    repository: {
      description: repository.description ?? "",
      language: repository.language ?? "",
      defaultBranch: repository.default_branch ?? "",
      url: repository.html_url ?? "https://github.com/" + fullName,
    },
    commits: recentCommits.map((item) => ({
      sha: String(item.sha ?? "").slice(0, 7),
      message: String(item.commit?.message ?? "").split("\n")[0].replaceAll("\r", ""),
      author: item.commit?.author?.name ?? item.author?.login ?? "Unknown",
      date: item.commit?.author?.date ?? item.commit?.committer?.date ?? "",
      url: item.html_url ?? "https://github.com/" + fullName + "/commit/" + item.sha,
    })),
    pulls: recentPulls.map((item) => ({ number: item.number, title: item.title, url: item.html_url })),
    releases: recentReleases.map((item) => ({ title: item.name || item.tag_name, url: item.html_url })),
  };
}

export function renderActivityBlock(results, failures = []) {
  const start = "<!-- ACTIVITY:START -->";
  const end = "<!-- ACTIVITY:END -->";
  let activity;
  if (results.length) {
    activity = results.map((result) => {
      const meta = [result.repository.language, result.repository.defaultBranch ? "default branch: " + result.repository.defaultBranch : ""].filter(Boolean);
      const description = result.repository.description ? "\n_" + escapeMarkdown(result.repository.description) + "_" : "";
      const commits = result.commits.map((item) =>
        "- Commit [" + item.sha + "](" + item.url + ") — " + escapeMarkdown(item.message) +
        " _(by " + escapeMarkdown(item.author) + (item.date ? ", " + item.date.replace("T", " ").replace("Z", " UTC") : "") + ")_"
      );
      const pulls = result.pulls.map((item) =>
        "- Merged PR [#" + item.number + " " + escapeMarkdown(item.title) + "](" + item.url + ")"
      );
      const releases = result.releases.map((item) =>
        "- Release [" + escapeMarkdown(item.title) + "](" + item.url + ")"
      );
      return "### [" + escapeMarkdown(result.fullName) + "](" + result.repository.url + ")" +
        (meta.length ? " · " + escapeMarkdown(meta.join(" · ")) : "") + description +
        "\n" + [...commits, ...pulls, ...releases].join("\n");
    }).join("\n\n");
  } else {
    activity = "_No repositories had commits in the last 24 hours._";
  }
  if (failures.length) {
    activity += "\n\n> ⚠️ Could not scan: " +
      failures.map((item) => escapeMarkdown(item.repository) + " (" + escapeMarkdown(item.reason) + ")").join("; ");
  }
  return start + "\n## Shipped Today (GitHub activity)\n" + activity + "\n" + end;
}

function escapeMarkdown(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replaceAll("|", "\\|");
}
