/**
 * Map each new line to the old line it continues, or -1 if it has no predecessor.
 * Identical lines are anchored by a longest common subsequence. Between two anchors,
 * an equal number of old and new lines counts as in-place edits (a corrected line keeps
 * its geometry); an unequal number means lines were inserted or deleted there, and the
 * new lines get -1 so geometry is never shifted onto a different line.
 * @param {string[]} oldLines
 * @param {string[]} newLines
 * @returns {number[]} Old index per new index
 */
export function alignLines(oldLines, newLines) {
  const n = oldLines.length;
  const m = newLines.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = oldLines[i] === newLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const origin = new Array(m).fill(-1);
  let i = 0;
  let j = 0;
  let gapStartOld = 0;
  let gapStartNew = 0;
  const closeGap = (endOld, endNew) => {
    if (endOld - gapStartOld !== endNew - gapStartNew) return;
    for (let k = 0; k < endNew - gapStartNew; k++) origin[gapStartNew + k] = gapStartOld + k;
  };

  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      closeGap(i, j);
      origin[j] = i;
      i++;
      j++;
      gapStartOld = i;
      gapStartNew = j;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  closeGap(n, m);
  return origin;
}
