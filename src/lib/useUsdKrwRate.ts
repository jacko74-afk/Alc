"use client";

import { DEFAULT_USD_KRW } from "@/lib/utils";
import { useEffect, useState } from "react";

export function useUsdKrwRate() {
  const [rate, setRate] = useState(DEFAULT_USD_KRW);

  useEffect(() => {
    let alive = true;
    void fetch("https://api.frankfurter.app/latest?from=USD&to=KRW")
      .then((res) => res.json())
      .then((data: { rates?: { KRW?: number } }) => {
        const next = data.rates?.KRW;
        if (alive && typeof next === "number" && next > 0) setRate(next);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  return rate;
}
