import { NextResponse } from "next/server";
import { readCatalog, writeCatalog, CATALOG_FILENAME } from "@/lib/catalog-file";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function checkPassword(password: string | undefined) {
  const expected =
    process.env.ADMIN_PASSWORD || process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin";
  return password === expected;
}

export async function GET() {
  const catalog = await readCatalog();
  if (!catalog) {
    return NextResponse.json({
      products: [],
      source: "empty",
      file: CATALOG_FILENAME,
      savedAt: null,
    });
  }
  return NextResponse.json({
    products: catalog.products,
    source: "live",
    file: CATALOG_FILENAME,
    savedAt: catalog.savedAt || null,
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { password?: string; products?: Product[] };
  if (!checkPassword(body.password)) {
    return NextResponse.json({ error: "관리자 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  if (!Array.isArray(body.products) || body.products.length === 0) {
    return NextResponse.json({ error: "저장할 상품이 없습니다." }, { status: 400 });
  }
  const catalog = await writeCatalog(body.products);
  return NextResponse.json({
    ok: true,
    products: catalog.products,
    file: CATALOG_FILENAME,
    savedAt: catalog.savedAt,
  });
}
