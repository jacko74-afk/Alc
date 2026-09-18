"use client";

import { allProducts, DEFAULT_SEED_COUNT, SEED_COUNT_OPTIONS } from "@/data/products";
import {
  getSeedCount,
  loadLiveCatalog,
  saveLiveCatalog,
  seedCatalog,
  setSeedCount as persistSeedCount,
} from "@/lib/store";
import type { MallId, MallListing, Product } from "@/lib/types";
import { MALLS, MALL_FALLBACK_URLS } from "@/lib/types";
import { useUsdKrwRate } from "@/lib/useUsdKrwRate";
import { ADMIN_STORAGE_KEY, formatKrw } from "@/lib/utils";
import { useEffect, useState } from "react";

const DEFAULT_PASSWORD = "admin";

function emptyListing(mallId: MallId): MallListing {
  return {
    url: MALL_FALLBACK_URLS[mallId],
    adultOnly: { priceUsd: null },
    loggedIn: { priceUsd: null },
  };
}

const ADMIN_PASSWORD_KEY = "dutyfree_admin_password";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<Product[]>([]);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [scraping, setScraping] = useState(false);
  const [seedCount, setSeedCount] = useState(DEFAULT_SEED_COUNT);
  const [saving, setSaving] = useState(false);
  const rate = useUsdKrwRate();

  async function loadAdminItems() {
    const catalog = await loadLiveCatalog();
    if (catalog.products.length > 0) {
      setSeedCount(catalog.products.length);
      persistSeedCount(catalog.products.length);
      setItems(catalog.products);
      return;
    }
    const count = getSeedCount();
    setSeedCount(count);
    setItems(seedCatalog(count));
  }

  useEffect(() => {
    if (sessionStorage.getItem(ADMIN_STORAGE_KEY) === "1") {
      setAuthed(true);
      setPassword(sessionStorage.getItem(ADMIN_PASSWORD_KEY) || "admin");
      void loadAdminItems();
    }
  }, []);

  function login() {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || DEFAULT_PASSWORD;
    if (password !== expected) {
      setMessage("비밀번호가 올바르지 않습니다.");
      return;
    }
    sessionStorage.setItem(ADMIN_STORAGE_KEY, "1");
    sessionStorage.setItem(ADMIN_PASSWORD_KEY, password);
    setAuthed(true);
    void loadAdminItems();
    setMessage("");
  }

  async function scrape() {
    setScraping(true);
    setLogs(["수집 요청을 보냈습니다. 곧 브라우저가 열립니다."]);
    setMessage("성인인증가 수집 중... 열린 창에서 성인인증만 하세요. 멈추려면 수집 중단을 누르세요.");
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch("/api/admin/scrape", { cache: "no-store" });
        const data = (await res.json()) as { logs?: string[] };
        if (data.logs) setLogs(data.logs);
      } catch {
        /* ignore */
      }
    }, 2000);
    try {
      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, limit: seedCount }),
      });
      const data = (await res.json()) as {
        products?: Product[];
        logs?: string[];
        error?: string;
      };
      if (data.logs) setLogs(data.logs);
      if (!res.ok) {
        setMessage(data.error || "수집에 실패했습니다.");
        return;
      }
      if (data.products) {
        setItems(data.products);
        setSeedCount(data.products.length);
        persistSeedCount(data.products.length);
        setMessage(
          `성인인증가 ${data.products.length}개를 live-prices.json에 저장했습니다. 셀러는 이 JSON을 불러 비교합니다.`,
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "수집 요청 실패");
    } finally {
      window.clearInterval(timer);
      setScraping(false);
    }
  }

  async function stopScrape() {
    try {
      await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, action: "stop" }),
      });
      setMessage("중단 신호를 보냈습니다. 잠시 후 지금까지 모은 가격이 저장됩니다.");
      setLogs((prev) => [...prev, "중단 요청을 보냈습니다."]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "중단 요청 실패");
    }
  }

  function updatePrice(
    id: string,
    mallId: MallId,
    field: "adultOnly" | "original",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const listing = item.listings[mallId] ?? emptyListing(mallId);
        const parsed = value.trim() === "" ? null : Number(value);
        const num = Number.isFinite(parsed as number) ? parsed : null;
        if (field === "original") {
          return {
            ...item,
            listings: {
              ...item.listings,
              [mallId]: {
                ...listing,
                adultOnly: { ...listing.adultOnly, originalUsd: num },
              },
            },
          };
        }
        return {
          ...item,
          listings: {
            ...item.listings,
            [mallId]: {
              ...listing,
              adultOnly: {
                ...listing.adultOnly,
                priceUsd: num,
              },
            },
          },
        };
      }),
    );
  }

  function changeSeedCount(value: string) {
    const next = Number(value);
    if (!Number.isFinite(next)) return;
    persistSeedCount(next);
    setSeedCount(next);
    setItems(seedCatalog(next, items));
    setMessage(
      `시드를 ${next}개로 맞췄습니다. 수집하거나 JSON 파일 저장을 누르면 셀러에 반영됩니다.`,
    );
  }

  async function persist() {
    setSaving(true);
    try {
      const saved = await saveLiveCatalog(password, items);
      setMessage(
        `${items.length}개를 ${saved.file || "live-prices.json"}에 저장했습니다. 셀러에서 이 파일을 불러 비교합니다.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "JSON 저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function reloadJson() {
    const catalog = await loadLiveCatalog();
    if (catalog.products.length === 0) {
      setMessage("저장된 JSON 파일이 없습니다. 먼저 수집하거나 JSON 파일 저장을 하세요.");
      return;
    }
    setItems(catalog.products);
    setSeedCount(catalog.products.length);
    persistSeedCount(catalog.products.length);
    setMessage(
      `${catalog.file}에서 ${catalog.products.length}개를 불러왔습니다.`,
    );
  }

  function restore() {
    const next = seedCatalog(seedCount);
    setItems(next);
    setMessage("시드 데이터로 되돌렸습니다. 셀러에 반영하려면 JSON 파일 저장을 누르세요.");
  }

  function download() {
    const blob = new Blob([JSON.stringify(items, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "live-prices.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <div className="mx-auto max-w-sm rounded-2xl border border-gold-400/25 bg-cream-50 p-6 shadow-bottle">
        <p className="text-[11px] tracking-[0.28em] text-gold-700">ADMIN CELLAR</p>
        <h1 className="font-display mt-1 text-2xl font-semibold">관리자</h1>
        <p className="mt-1 text-sm text-espresso-700">
          기본 비밀번호는 <code>admin</code> 입니다.{" "}
          <code>NEXT_PUBLIC_ADMIN_PASSWORD</code>로 바꿀 수 있습니다.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-4 w-full rounded-md border border-espresso-700/15 bg-white px-3 py-2"
          placeholder="비밀번호"
        />
        <button type="button" onClick={login} className="btn-wine mt-3 w-full">
          들어가기
        </button>
        {message ? <p className="mt-2 text-sm text-wine-700">{message}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold">가격 관리</h1>
      <p className="mt-1 text-sm text-espresso-700">
        성인인증가만 가져옵니다. 수집이 끝나면 <code>data/live-prices.json</code>에
        저장되며, 셀러는 이 JSON 파일을 불러 비교합니다. 표 내용을 수정한 뒤에는
        JSON 파일 저장을 누르세요.
      </p>
      <label className="mt-4 flex flex-wrap items-center gap-2 text-sm text-espresso-800">
        시드 개수
        <select
          value={seedCount}
          disabled={scraping}
          onChange={(e) => changeSeedCount(e.target.value)}
          className="rounded-md border border-espresso-700/15 bg-white px-2 py-1.5"
        >
          {SEED_COUNT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === allProducts.length ? `전체 ${n}개` : `${n}개`}
            </option>
          ))}
        </select>
        <span className="text-espresso-700/60">
          기본 {DEFAULT_SEED_COUNT}개 · 현재 {items.length} / {allProducts.length}
        </span>
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={scraping}
          onClick={() => void scrape()}
          className="btn-wine disabled:opacity-50"
        >
          실제 가격 수집 (성인)
        </button>
        <button
          type="button"
          disabled={!scraping}
          onClick={() => void stopScrape()}
          className="btn-outline disabled:opacity-50"
        >
          수집 중단
        </button>
        <button type="button" disabled={saving || scraping} onClick={() => void persist()} className="btn-gold disabled:opacity-50">
          JSON 파일 저장
        </button>
        <button type="button" disabled={scraping} onClick={() => void reloadJson()} className="btn-outline disabled:opacity-50">
          저장된 JSON 불러오기
        </button>
        <button type="button" onClick={restore} className="btn-outline">
          시드 되돌리기
        </button>
        <button type="button" onClick={download} className="btn-outline">
          JSON 내려받기
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-wine-700">{message}</p> : null}
      {logs.length > 0 ? (
        <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-espresso-950 p-3 text-[11px] text-gold-100">
          {logs.join("\n")}
        </pre>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-gold-400/25 bg-cream-50">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-espresso-900 text-gold-300">
            <tr>
              <th className="px-2 py-2">상품</th>
              {MALLS.map((mall) => (
                <th key={mall.id} className="px-2 py-2" colSpan={2}>
                  {mall.label} 원래 / 성인
                </th>
              ))}
            </tr>
          </thead>
          <tbody key={items.map((item) => item.id).join("|")}>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-gold-400/15">
                <td className="px-2 py-2 font-medium">
                  {item.brand} {item.name}
                </td>
                {MALLS.map((mall) => {
                  const listing = item.listings[mall.id];
                  return (
                    <td key={mall.id} className="px-2 py-2" colSpan={2}>
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <input
                            className="w-16 rounded border border-espresso-700/15 px-1 py-1"
                            placeholder="원래"
                            defaultValue={listing?.adultOnly.originalUsd ?? ""}
                            onBlur={(e) =>
                              updatePrice(item.id, mall.id, "original", e.target.value)
                            }
                          />
                          <input
                            className="w-16 rounded border border-espresso-700/15 px-1 py-1"
                            placeholder="성인"
                            defaultValue={listing?.adultOnly.priceUsd ?? ""}
                            onBlur={(e) =>
                              updatePrice(item.id, mall.id, "adultOnly", e.target.value)
                            }
                          />
                        </div>
                        <p className="text-[10px] text-espresso-700/50">
                          {listing?.adultOnly.originalUsd != null
                            ? `원래 ${formatKrw(listing.adultOnly.originalUsd, rate)}`
                            : "원래 —"}{" "}
                          /{" "}
                          {listing?.adultOnly.priceUsd != null
                            ? `성인 ${formatKrw(listing.adultOnly.priceUsd, rate)}`
                            : "성인 —"}
                        </p>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
