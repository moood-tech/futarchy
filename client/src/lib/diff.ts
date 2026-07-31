/** Minimal LCS-based line diff, enough to render a git-style unified diff. */

export interface DiffLine {
  type: "ctx" | "add" | "del";
  text: string;
}

export function lineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // dp[i][j] = length of LCS of a[i:] and b[j:]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i] });
      i++;
    } else {
      out.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}

export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((d) => d.type !== "ctx");
}

export interface DiffHunkLine extends DiffLine {
  oldNo?: number; // 1-based line number in the base document (del + ctx)
  newNo?: number; // 1-based line number in the proposed document (add + ctx)
}

export interface DiffHunk {
  header: string; // @@ -oldStart,oldCount +newStart,newCount @@
  lines: DiffHunkLine[];
}

/**
 * Split a diff into GitHub-style hunks: contiguous changed regions, each with
 * up to `context` unchanged lines around them. Separate changes become separate
 * hunks (rendered as separate cards).
 */
export function toHunks(diff: DiffLine[], context = 3): DiffHunk[] {
  interface NL extends DiffLine {
    oldNo?: number;
    newNo?: number;
  }
  const annotated: NL[] = [];
  let oldNo = 0;
  let newNo = 0;
  for (const d of diff) {
    if (d.type === "ctx") annotated.push({ ...d, oldNo: ++oldNo, newNo: ++newNo });
    else if (d.type === "del") annotated.push({ ...d, oldNo: ++oldNo });
    else annotated.push({ ...d, newNo: ++newNo });
  }

  const n = annotated.length;
  const keep = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (annotated[i].type !== "ctx") {
      for (let j = Math.max(0, i - context); j <= Math.min(n - 1, i + context); j++) keep[j] = true;
    }
  }

  const hunks: DiffHunk[] = [];
  let i = 0;
  while (i < n) {
    if (!keep[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && keep[j]) j++;
    const slice = annotated.slice(i, j);
    const firstOld = slice.find((l) => l.oldNo !== undefined)?.oldNo ?? 0;
    const firstNew = slice.find((l) => l.newNo !== undefined)?.newNo ?? 0;
    const oldCount = slice.filter((l) => l.type !== "add").length;
    const newCount = slice.filter((l) => l.type !== "del").length;
    hunks.push({
      header: `@@ -${firstOld},${oldCount} +${firstNew},${newCount} @@`,
      lines: slice.map(({ type, text, oldNo, newNo }) => ({ type, text, oldNo, newNo })),
    });
    i = j;
  }
  return hunks;
}
