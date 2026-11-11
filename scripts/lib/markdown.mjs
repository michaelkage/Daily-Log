export function replaceMarkdownSection(markdown, heading, value) {
  if (typeof markdown !== "string") throw new TypeError("markdown must be a string.");
  if (typeof heading !== "string" || !heading.trim() || /[\r\n]/.test(heading)) {
    throw new TypeError("heading must be a non-empty single line.");
  }
  if (typeof value !== "string") throw new TypeError("value must be a string.");

  const escaped = heading.replace(/[.*+?^{}()|[\]\\]/g, "\\$&").replaceAll("$", "\\$");
  const headingPattern = new RegExp("^(#{1,6})[ \\t]+" + escaped + "[ \\t]*\\r?$", "gm");
  const matches = [...markdown.matchAll(headingPattern)];

  for (const duplicate of matches.slice(1).reverse()) {
    const level = duplicate[1].length;
    let contentStart = duplicate.index + duplicate[0].length;
    if (markdown.slice(contentStart, contentStart + 2) === "\r\n") contentStart += 2;
    else if (markdown[contentStart] === "\n") contentStart += 1;

    const boundaryPattern = new RegExp(
      "^#{1," + level + "}[ \\t]+|^---[ \\t]*$|^<!-- ACTIVITY:START -->$|^<!-- ACTIVITY:END -->$",
      "gm",
    );
    boundaryPattern.lastIndex = contentStart;
    const boundary = boundaryPattern.exec(markdown);
    const end = boundary ? boundary.index : markdown.length;
    const before = markdown.slice(0, duplicate.index).replace(/\n+$/, "");
    const after = markdown.slice(end).replace(/^\n+/, "");
    markdown = before + (before ? "\n\n" : "") + after;
  }

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

  return markdown.slice(0, contentStart) + value.trim() + "\n\n" + markdown.slice(end).replace(/^\n+/, "");
}
