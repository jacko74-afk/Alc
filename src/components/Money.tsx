"use client";

import { formatKrw, formatUsd } from "@/lib/utils";

export function Money({
  usd,
  rate,
  strike = false,
}: {
  usd: number | null | undefined;
  rate: number;
  strike?: boolean;
}) {
  if (usd == null) return <span>확인 불가</span>;
  return (
    <span className="inline-block">
      <span className={strike ? "line-through" : undefined}>{formatUsd(usd)}</span>
      <span
        className={`ml-1 text-[11px] font-normal ${
          strike ? "text-espresso-700/40 line-through" : "text-espresso-700/55"
        }`}
      >
        {formatKrw(usd, rate)}
      </span>
    </span>
  );
}
