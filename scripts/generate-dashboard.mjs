import { getFile, getTree, putFile } from "./lib/github.mjs";

const tree = await getTree();
if (tree.truncated) throw new Error("Git tree response was truncated; refusing to publish an incomplete dashboard.");
const entries = (tree.tree ?? [])
  .map((item) => {
    const match = item.path.match(/^logs\/(\d{4})\/(\d{2})\/(\d{4}-\d{2}-\d{2})\.md$/);
    return match ? { path: item.path, date: match[3] } : null;
  })
  .filter(Boolean)
  .sort((a, b) => b.date.localeCompare(a.date));
const dates = [...new Set(entries.map((item) => item.date))];
const total = dates.length;
const dateSet = new Set(dates);
let streak = 0;
const cursor = new Date();
cursor.setUTCHours(0, 0, 0, 0);
if (!dateSet.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
while (dateSet.has(cursor.toISOString().slice(0, 10))) {
  streak += 1;
  cursor.setUTCDate(cursor.getUTCDate() - 1);
}

const recent = await Promise.all(entries.slice(0, 10).map(async (entry) => {
  const file = await getFile(entry.path);
  if (!file) return null;
  const highlight = extractHighlight(file.content);
  const tags = [...file.content.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]+)/g)].map((match) => match[1]).slice(0, 4);
  const label = highlight || "Daily engineering log";
  return `| [${entry.date}](${entry.path}) | ${escapeCell(label)} | ${tags.length ? tags.map((tag) => `\`#${tag}\``).join(" ") : "—"} |`;
}));
const rows = recent.filter(Boolean);
const dashboard = `<!-- START -->
## 📊 Engineering Dashboard

![Total logs](https://img.shields.io/badge/logs-${total}-2563eb?style=flat-square)
![Current streak](https://img.shields.io/badge/current%20streak-${streak}%20days-16a34a?style=flat-square)

Public engineering journal — experiments, shipped work, lessons, and next steps.

### Recent entries

| Date (UTC) | Highlight | Tags |
|---|---|---|
${rows.length ? rows.join("\n") : "| No entries yet | Your first log will appear here | — |"}

### Archive

Browse the complete history in [logs/](logs/) and weekly reviews in [weekly/](weekly/).

### Capture a day

[Open a Daily Log issue](../../issues/new?template=daily-log.yml) to record your progress without editing Markdown by hand.

### Configuration

Set the repository variable \\`GH_ACTIVITY_REPOS\\` to a comma- or newline-separated list of \\`owner/repository\\` names to include activity from other repositories. For private or cross-repository access, add a \\`GH_ACTIVITY_TOKEN\\` Actions secret with read access to those repositories. Without it, activity collection uses the workflow's repository-scoped token.

<!-- END -->

## About

This repository documents daily engineering progress and lessons learned, building in public one commit at a time.

_Repository established February 3, 2026. The original launch notes remain in the repository history._
`;
const readme = await getFile("README.md");
if (!readme) throw new Error("README.md is missing.");
await putFile("README.md", dashboard, "docs: refresh engineering dashboard", readme.sha);
console.log(`Dashboard updated: ${total} logs, ${streak}-day current streak.`);

function extractHighlight(markdown) {
  const headings = ["Shipped", "What I Built", "Shipped Today", "Highlight"];
  for (const heading of headings) {
    const pattern = new RegExp(`^###? [^\\n]*${heading}[^\\n]*\\n+([\\s\\S]*?)(?=^###? |^---|$)`, "im");
    const match = markdown.match(pattern);
    if (match) {
      const line = match[1].split("\n").map((item) => item.replace(/^\s*[-*]\s*/, "").trim()).find((item) => item && !item.startsWith("<!--"));
      if (line) return line.replace(/^_+|_+$/g, "").slice(0, 180);
    }
  }
  return "";
}
function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}
