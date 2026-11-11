import { deleteFile, getFile, getTree, putFile } from "./lib/github.mjs";

const tree = await getTree();
if (tree.truncated) throw new Error("Git tree response was truncated; refusing to migrate an incomplete file list.");
const legacyFiles = (tree.tree ?? [])
  .map((item) => item.path.match(/^(\d{4})-(\d{2})-(\d{2})\.md$/))
  .filter(Boolean)
  .filter(([, year, month, day]) => {
    const date = new Date(`${year}-${month}-${day}T00:00:00Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === `${year}-${month}-${day}`;
  });

for (const [, year, month, day] of legacyFiles) {
  const date = `${year}-${month}-${day}`;
  const sourcePath = `${date}.md`;
  const targetPath = `logs/${year}/${month}/${date}.md`;
  const [source, target] = await Promise.all([getFile(sourcePath), getFile(targetPath)]);
  if (!source) continue;
  if (target) {
    console.warn(`Keeping ${sourcePath}: destination already exists at ${targetPath}.`);
    continue;
  }
  await putFile(targetPath, source.content, `chore(log): migrate ${date} into archive`);
  await deleteFile(sourcePath, source.sha, `chore(log): remove migrated root entry ${date}`);
  console.log(`Migrated ${sourcePath} -> ${targetPath}`);
}
