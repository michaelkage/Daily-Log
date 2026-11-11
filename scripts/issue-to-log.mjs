import { getFile, getIssue, putFile } from "./lib/github.mjs";
import { replaceMarkdownSection } from "./lib/markdown.mjs";

const number = Number(process.env.ISSUE_NUMBER);
if (!Number.isInteger(number) || number < 1) throw new Error("ISSUE_NUMBER must be a positive integer.");

const issue = await getIssue(number);
const body = typeof issue.body === "string" ? issue.body : "";
const dateMatch = body.match(/^### Log date \(UTC\)\s*\r?\n+([^\r\n]+)/m);
const requestedDate = dateMatch?.[1]?.trim();
const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? "") ? requestedDate : new Date().toISOString().slice(0, 10);
const parsed = new Date(date + "T00:00:00Z");
if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
  throw new Error("Invalid log date: " + date);
}

const [year, month] = date.split("-");
const path = "logs/" + year + "/" + month + "/" + date + ".md";
const fields = Object.fromEntries(["Shipped", "Learned", "Blockers", "Tomorrow"].map((label) => {
  const escaped = label.replace(/[.*+?^{}()|[\]\\]/g, "\\$&").replaceAll("$", "\\$");
  const pattern = new RegExp("^### " + escaped + "\\s*\\r?\\n+([\\s\\S]*?)(?=^### |$(?![\\s\\S]))", "m");
  const value = (body.match(pattern)?.[1] ?? "").trim();
  return [label, value && value !== "_No response_" ? value : "_Not provided._"];
}));

const file = await getFile(path);
let content = file?.content ?? "# Daily Log — " + date + "\n\n**Day:** Captured from issue [#" + number + "](" + issue.html_url + ")\n";
for (const [heading, value] of Object.entries(fields)) {
  content = replaceMarkdownSection(content, heading, value);
}
if (!content.includes("[issue #" + number + "]")) {
  content = content.trimEnd() + "\n\n_Source: [issue #" + number + "](" + issue.html_url + ")_\n";
}

await putFile(path, content, "docs(log): save issue #" + number + " as " + date, file?.sha);
console.log("Saved issue #" + number + " to " + path + ".");
