/** Binary search: returns index of largest element where key(arr[i]) <= target */
export function bisectRight<T>(arr: T[], target: number, key: (item: T) => number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (key(arr[mid]) <= target) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Find exact index where key(arr[i]) === target, or -1 */
export function findIndex<T>(arr: T[], target: number, key: (item: T) => number): number {
  const idx = bisectRight(arr, target, key);
  if (idx >= 0 && key(arr[idx]) === target) return idx;
  return -1;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Find previous element strictly less than target timestamp */
export function prevTimestamp<T>(arr: T[], target: number, key: (item: T) => number): T | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (key(arr[i]) < target) return arr[i];
  }
  return null;
}

/** Find next element strictly greater than target timestamp */
export function nextTimestamp<T>(arr: T[], target: number, key: (item: T) => number): T | null {
  for (let i = 0; i < arr.length; i++) {
    if (key(arr[i]) > target) return arr[i];
  }
  return null;
}
