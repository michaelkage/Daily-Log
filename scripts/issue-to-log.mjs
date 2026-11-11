import { getFile, getIssue, putFile } from "./lib/github.mjs";

const number = Number(process.env.ISSUE_NUMBER);
if (!Number.isInteger(number) || number < 1) throw new Error("ISSUE_NUMBER must be a positive integer.");
const issue = await getIssue(number);
const dateMatch = issue.body.match(/^### Log date \(UTC\)\s*\r?\n+([^\r\n]+)/m);
const requestedDate = dateMatch?.[1]?.trim();
const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? "") ? requestedDate : new Date().toISOString().slice(0, 10);
const parsed = new Date(`${date}T00:00:00Z`);
if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`Invalid log date: ${date}`);
const [year, month] = date.split("-");
const path = `logs/${year}/${month}/${date}.md`;

const fields = Object.fromEntries(["Shipped", "Learned", "Blockers", "Tomorrow"].map((label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = issue.body.match(new RegExp(`^### ${escaped}\\s*\\r?\\n+([\\s\\S]*?)(?=^### |$(?![\\s\\S]))`, "m"));
  const value = (match?.[1] ?? "").trim();
  return [label, value && value !== "_No response_" ? value : "_Not provided._"];
}));

let file = await getFile(path);
let content = file?.content ?? `# Daily Log — ${date}\n\n**Day:** Captured from issue [#${number}](${issue.html_url})\n`;
for (const [heading, value] of Object.entries(fields)) {
  content = replaceSection(content, heading, value);
}
if (!content.includes(`[issue #${number}]`)) content += `\n_Source: [issue #${number}](${issue.html_url})_\n`;
await putFile(path, content, `docs(log): save issue #${number} as ${date}`, file?.sha);
console.log(`Saved issue #${number} to ${path}.`);

function replaceSection(markdown, heading, value) {
  const marker = `### ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) return `${markdown.trimEnd()}\n\n${marker}\n${value}\n`;
  const contentStart = markdown.indexOf("\n", start) + 1;
  if (contentStart === 0) throw new Error(`Malformed section heading: ${heading}`);
  const nextHeading = markdown.indexOf("\n### ", contentStart);
  const suffix = nextHeading < 0 ? "" : markdown.slice(nextHeading + 1);
  return `${markdown.slice(0, contentStart)}${value}\n\n${suffix}`;
}
