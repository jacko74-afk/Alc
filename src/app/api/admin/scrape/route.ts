import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { allProducts, DEFAULT_SEED_COUNT } from "@/data/products";
import { runScrape } from "@/lib/scraper/run";
import { setScrapeCancel } from "@/lib/scraper/control";

export const runtime = "nodejs";
export const maxDuration = 1800;
export const dynamic = "force-dynamic";

const progressFile = () => path.join(process.cwd(), "data", "scrape-progress.json");

function checkPassword(password: string | undefined) {
  const expected =
    process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
  return password === expected;
}

async function writeProgress(logs: string[], done: boolean, error?: string) {
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await writeFile(
    progressFile(),
    JSON.stringify({ logs, done, error: error ?? null, at: new Date().toISOString() }),
    "utf8",
  );
}

export async function GET() {
  try {
    const raw = await readFile(progressFile(), "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ logs: [], done: true });
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    password?: string;
    action?: string;
    limit?: number;
  };
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (body.action === "stop") {
    await setScrapeCancel(true);
    return NextResponse.json({ ok: true, stopped: true });
  }

  await setScrapeCancel(false);
  const logs: string[] = [];

  try {
    const limitRaw = Number(body.limit);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.round(limitRaw)), allProducts.length)
      : DEFAULT_SEED_COUNT;
    logs.push(`수집을 시작합니다. 시드 ${limit}개, 성인인증가만 가져옵니다.`);
    await writeProgress(logs, false);
    const products = await runScrape((line) => {
      logs.push(line);
      void writeProgress(logs, false);
    }, limit);
    await writeProgress(logs, true);
    return NextResponse.json({ products, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logs.push(`실패: ${message}`);
    await writeProgress(logs, true, message);
    return NextResponse.json({ error: message, logs }, { status: 500 });
  }
}
