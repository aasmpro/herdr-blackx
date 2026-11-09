// Porcelain paths are repository-relative, including when Files browses a subdirectory.
export function gitMarks(root, status, committedDirectories, limit = 5000) {
  const existing = new Set(committedDirectories.split("\0").filter(Boolean));
  const files = {}, directories = {};
  for (const entry of status.split("\0").filter(Boolean).slice(0, limit)) {
    const xy = entry.slice(0, 2), path = entry.slice(3);
    const mark = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
    files[`${root}/${path}`] = mark;
    for (let end = path.lastIndexOf("/"); end > 0; end = path.lastIndexOf("/", end - 1)) {
      const directory = path.slice(0, end), key = `${root}/${directory}`;
      // Existing ancestors are modified, even if their only change is an added file.
      const state = existing.has(directory) || mark !== "A" ? "M" : "A";
      directories[key] = directories[key] === "M" ? "M" : state;
    }
  }
  // A path changing between a file and a directory must retain its directory state.
  return {...files, ...directories};
}
