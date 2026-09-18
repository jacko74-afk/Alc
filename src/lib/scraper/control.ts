import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const controlFile = () => path.join(process.cwd(), "data", "scrape-control.json");

export class ScrapeStoppedError extends Error {
  constructor() {
    super("수집이 중단되었습니다.");
    this.name = "ScrapeStoppedError";
  }
}

export async function setScrapeCancel(cancel: boolean) {
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await writeFile(controlFile(), JSON.stringify({ cancel }), "utf8");
}

export async function isScrapeCancelled() {
  try {
    const raw = await readFile(controlFile(), "utf8");
    return Boolean((JSON.parse(raw) as { cancel?: boolean }).cancel);
  } catch {
    return false;
  }
}

export async function throwIfCancelled() {
  if (await isScrapeCancelled()) throw new ScrapeStoppedError();
}
