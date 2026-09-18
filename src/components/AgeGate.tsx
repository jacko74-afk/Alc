"use client";

import { AGE_DAYS, AGE_STORAGE_KEY, isAdult } from "@/lib/utils";
import { createContext, useContext, useEffect, useState } from "react";

type GateState = "loading" | "need" | "ok" | "blocked";

const AgeContext = createContext(false);

export function useAgeVerified() {
  return useContext(AgeContext);
}

export function AgeGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GateState>("loading");
  const [birth, setBirth] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AGE_STORAGE_KEY);
      if (!raw) {
        setState("need");
        return;
      }
      const parsed = JSON.parse(raw) as { until: number };
      if (parsed.until > Date.now()) {
        setState("ok");
        return;
      }
    } catch {
      /* ignore */
    }
    localStorage.removeItem(AGE_STORAGE_KEY);
    setState("need");
  }, []);

  function confirm() {
    if (!isAdult(birth)) {
      setError("만 19세 미만이거나 생년월일이 올바르지 않습니다.");
      setState("blocked");
      return;
    }
    const until = Date.now() + AGE_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(AGE_STORAGE_KEY, JSON.stringify({ until }));
    setState("ok");
  }

  if (state === "loading") {
    return <div className="min-h-screen bg-espresso-950" />;
  }

  if (state !== "ok") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-espresso-950 p-4">
        <div className="w-full max-w-md rounded-2xl border border-gold-500/30 bg-espresso-900 p-8 text-cream-50 shadow-bottle">
          <p className="text-[11px] tracking-[0.32em] text-gold-400">
            ADULTS ONLY
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold">
            만 19세 이상만 입장할 수 있습니다
          </h1>
          <p className="mt-3 text-sm leading-6 text-cream-200/80">
            청소년보호법에 따라 주류 정보를 보려면 생년월일 확인이 필요합니다.
            이 확인은 면세점 본인인증과 다르며 별도 비용이 없습니다.
          </p>
          {state === "blocked" ? (
            <div className="mt-6">
              <p className="rounded-lg border border-wine-500/40 bg-wine-900/40 p-3 text-sm text-gold-100">
                이용할 수 없습니다. {error}
              </p>
              <button
                type="button"
                onClick={() => {
                  setState("need");
                  setError("");
                  setBirth("");
                }}
                className="btn-ghost mt-4 w-full"
              >
                다시 입력
              </button>
            </div>
          ) : (
            <>
              <label className="mt-6 block text-sm font-medium text-gold-200">
                생년월일 8자리
                <input
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="19900101"
                  value={birth}
                  onChange={(e) =>
                    setBirth(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  className="mt-2 w-full rounded-md border border-gold-500/30 bg-espresso-950 px-3 py-2.5 text-base text-cream-50 outline-none placeholder:text-cream-200/30 focus:border-gold-400"
                />
              </label>
              {error ? <p className="mt-2 text-sm text-gold-300">{error}</p> : null}
              <button type="button" onClick={confirm} className="btn-gold mt-5 w-full">
                만 19세 이상입니다
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return <AgeContext.Provider value={true}>{children}</AgeContext.Provider>;
}
