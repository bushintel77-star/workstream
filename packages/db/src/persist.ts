import { existsSync, readFileSync } from "fs";
import { writeFile, mkdir, rename } from "fs/promises";
import { dirname } from "path";

type Snapshotable = Record<string, unknown[]>;

export function loadSnapshotInto(path: string, arrays: Snapshotable): boolean {
  if (!existsSync(path)) return false;
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as Snapshotable;
    for (const key of Object.keys(arrays)) {
      const incoming = data[key];
      if (Array.isArray(incoming)) {
        arrays[key].length = 0;
        arrays[key].push(...incoming);
      }
    }
    return true;
  } catch (err) {
    console.error(`[db] failed to load snapshot at ${path}:`, err);
    return false;
  }
}

export function makeFlusher(path: string, arrays: Snapshotable) {
  let pending: Promise<void> = Promise.resolve();
  let dirty = false;
  let scheduled: ReturnType<typeof setTimeout> | null = null;

  const writeNow = async () => {
    dirty = false;
    const snapshot: Snapshotable = {};
    for (const key of Object.keys(arrays)) snapshot[key] = arrays[key];
    const tmp = `${path}.tmp`;
    await mkdir(dirname(path), { recursive: true });
    await writeFile(tmp, JSON.stringify(snapshot, null, 2), "utf8");
    await rename(tmp, path);
  };

  return function flush(): void {
    dirty = true;
    if (scheduled) return;
    scheduled = setTimeout(() => {
      scheduled = null;
      if (!dirty) return;
      pending = pending.then(writeNow).catch((err) => {
        console.error(`[db] snapshot write failed:`, err);
      });
    }, 25);
  };
}
