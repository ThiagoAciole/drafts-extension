export function buildNoteTitle(content) {
  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return "Untitled note";
  }

  const words = firstLine.split(/\s+/).filter(Boolean).slice(0, 3);
  if (!words.length) {
    return "Untitled note";
  }

  return words.join(" ");
}
