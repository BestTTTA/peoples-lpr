import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Report } from "./types";

// Flat-file storage: fine for a single server. Swap for a database before
// running more than one instance.
export const DATA_DIR = path.join(process.cwd(), "data");
export const FILES_DIR = path.join(DATA_DIR, "files");
const DB_FILE = path.join(DATA_DIR, "reports.json");

let cache: Report[] | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function load(): Promise<Report[]> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(DB_FILE, "utf8")) as Report[];
  } catch {
    cache = [];
  }
  return cache;
}

export async function listReports(): Promise<Report[]> {
  return load();
}

export async function saveFile(name: string, data: Uint8Array): Promise<void> {
  await mkdir(FILES_DIR, { recursive: true });
  await writeFile(path.join(FILES_DIR, name), data);
}

export function addReport(report: Report): Promise<void> {
  // Serialize writes so concurrent submissions don't clobber each other.
  const run = queue.then(async () => {
    const all = await load();
    all.push(report);
    await mkdir(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(all));
    await rename(tmp, DB_FILE);
  });
  queue = run.catch(() => {});
  return run;
}
