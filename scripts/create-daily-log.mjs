import { getFile, getTree, putFile } from "./lib/github.mjs";

const now = new Date();
const date = now.toISOString().slice(0, 10);
const [year, month] = date.split("-");
const path = `logs/${year}/${month}/${date}.md`;

const existing = await getFile(path);
if (existing) {
  console.log(`Entry already exists: ${path}`);
  process.exit(0);
}

const templateFile = await getFile("template.md");
if (!templateFile) throw new Error("template.md is missing.");

const tree = await getTree();
if (tree.truncated) throw new Error("Git tree response was truncated; refusing to calculate an incorrect day number.");
const dates = (tree.tree ?? [])
  .map((item) => item.path.match(/^logs\/\d{4}\/\d{2}\/(\d{4}-\d{2}-\d{2})\.md$/)?.[1])
  .filter(Boolean);
const dayNumber = dates.length + 1;
const content = templateFile.content
  .replaceAll("{{DATE}}", date)
  .replaceAll("{{DAY_NUMBER}}", String(dayNumber))
  .replaceAll("{{GITHUB_ACTIVITY}}", "_Activity will be collected automatically._");

await putFile(path, content, `chore(log): create daily entry for ${date}`);
console.log(`Created ${path} (entry #${dayNumber}).`);
