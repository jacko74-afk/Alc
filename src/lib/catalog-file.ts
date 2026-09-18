import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Product } from "@/lib/types";

export const CATALOG_FILENAME = "live-prices.json";

export type CatalogFile = {
  savedAt: string;
  products: Product[];
};

export function catalogPath() {
  return path.join(process.cwd(), "data", CATALOG_FILENAME);
}

function asProducts(value: unknown): Product[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every((item) => item && typeof item === "object" && "id" in item)) {
    return null;
  }
  return value as Product[];
}

export async function readCatalog(): Promise<CatalogFile | null> {
  try {
    const raw = await readFile(catalogPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const products = asProducts(parsed);
      if (!products) return null;
      return { savedAt: "", products };
    }
    if (parsed && typeof parsed === "object" && "products" in parsed) {
      const record = parsed as { savedAt?: unknown; products?: unknown };
      const products = asProducts(record.products);
      if (!products) return null;
      return {
        savedAt: typeof record.savedAt === "string" ? record.savedAt : "",
        products,
      };
    }
  } catch {
    /* no file yet */
  }
  return null;
}

export async function writeCatalog(products: Product[]): Promise<CatalogFile> {
  const payload: CatalogFile = {
    savedAt: new Date().toISOString(),
    products,
  };
  await mkdir(path.join(process.cwd(), "data"), { recursive: true });
  await writeFile(catalogPath(), JSON.stringify(payload, null, 2), "utf8");
  return payload;
}
