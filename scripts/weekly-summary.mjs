import { getFile, getTree, putFile } from "./lib/github.mjs";

const now = new Date();
const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
const weekday = monday.getUTCDay() || 7;
monday.setUTCDate(monday.getUTCDate() - weekday + 1);
const sunday = new Date(monday);
sunday.setUTCDate(sunday.getUTCDate() + 6);
const iso = isoWeek(monday);
const weekPath = `weekly/${iso.year}-W${String(iso.week).padStart(2, "0")}.md`;

const tree = await getTree();
if (tree.truncated) throw new Error("Git tree response was truncated; refusing to generate an incomplete weekly review.");
const paths = (tree.tree ?? []).map((item) => item.path)
  .filter((path) => /^logs\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}\.md$/.test(path))
  .filter((path) => {
    const date = path.match(/(\d{4}-\d{2}-\d{2})\.md$/)[1];
    return date >= monday.toISOString().slice(0, 10) && date <= sunday.toISOString().slice(0, 10);
  })
  .sort();
const parts = await Promise.all(paths.map(async (path) => {
  const file = await getFile(path);
  return file ? `## ${path.match(/(\d{4}-\d{2}-\d{2})\.md$/)[1]}\n\n${file.content.trim()}\n` : null;
}));
const content = `# Weekly Engineering Review — ${iso.year}-W${String(iso.week).padStart(2, "0")}\n\n**Period:** ${monday.toISOString().slice(0, 10)} to ${sunday.toISOString().slice(0, 10)} (UTC)\n\n${parts.filter(Boolean).join("\n---\n\n") || "_No daily entries were found for this week._"}\n`;
const existing = await getFile(weekPath);
await putFile(weekPath, content, `docs(weekly): publish ${iso.year}-W${String(iso.week).padStart(2, "0")} review`, existing?.sha);
console.log(`Published ${weekPath} from ${paths.length} daily entry/entries.`);

function isoWeek(date) {
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  return { year: thursday.getUTCFullYear(), week: 1 + Math.round((thursday - firstThursday) / 604800000) };
}
