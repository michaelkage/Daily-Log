export function replaceMarkdownSection(markdown, heading, value) {
  if (typeof markdown !== "string") throw new TypeError("markdown must be a string.");
  if (typeof heading !== "string" || !heading.trim() || /[\r\n]/.test(heading)) {
    throw new TypeError("heading must be a non-empty single line.");
  }
  if (typeof value !== "string") throw new TypeError("value must be a string.");

  const escaped = heading.replace(/[.*+?^{}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp("^(#{1,6})[ \\t]+" + escaped + "[ \\t]*\\r?$", "gm");
  const match = headingPattern.exec(markdown);

  if (!match) {
    return markdown.trimEnd() + "\n\n## " + heading + "\n" + value.trim() + "\n";
  }

  const level = match[1].length;
  let contentStart = match.index + match[0].length;
  if (markdown.slice(contentStart, contentStart + 2) === "\r\n") contentStart += 2;
  else if (markdown[contentStart] === "\n") contentStart += 1;

  const boundaryPattern = new RegExp(
    "^#{1," + level + "}[ \\t]+|^---[ \\t]*$|^<!-- ACTIVITY:START -->$|^<!-- ACTIVITY:END -->$",
    "gm",
  );
  boundaryPattern.lastIndex = contentStart;
  const boundary = boundaryPattern.exec(markdown);
  const end = boundary ? boundary.index : markdown.length;
  const prefix = markdown.slice(0, contentStart);
  const suffix = markdown.slice(end);

  return prefix + value.trim() + "\n\n" + suffix.replace(/^\n+/, "");
}
