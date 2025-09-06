
"use client";

import Link from "next/link";
import { memo } from "react";
import { OpenRow } from "../types";
import { fmt, ymd } from "../utils";
import FairTargetCell from "./FairTargetCell";
import FairValueCell from "./FairValueCell";
import AnalystFairCell from "./AnalystFairCell";
import FundamentalFairCell from "./FundamentalFairCell";
import GoodBuyCell from "./GoodBuyCell";
import FairEtaCell from "./FairEtaCell";
import EtaDaysCell from "./EtaDaysCell";
import RiskCell from "./RiskCell";
import Momentum5m from "./Momentum5m";
import SwingBadge from "./SwingBadge";
import TechChip from "./TechChip";
import NewsChip from "./NewsChip";
import RVOLVWAP from "./RVOLVWAP";
import Buzz from "./Buzz";
import News from "./News";

const OpenCallRow = memo(
  ({ id, ticker, entry, target, current, openedAt, openedBy, openedById }: OpenRow) => {
    const targetPct =
      entry != null && entry > 0 && target != null ? ((target - entry) / entry) * 100 : null;
    const remainingPct =
      current != null && current > 0 && target != null ? ((target - current) / current) * 100 : null;
    const earningsPct =
      entry != null && entry > 0 && current != null ? ((current - entry) / entry) * 100 : null;

    const entryStatus =
      entry != null && current != null ? (current >= entry ? "✅ Above Entry" : "❌ Below Entry") : "—";
    const targetStatus = (() => {
      if (target == null || current == null) return "—";
      if (target === 0) return "—";
      const diffPct = ((current - target) / target) * 100;
      if (Math.abs(diffPct) < 0.5) return "✅ Near Target";
      return diffPct >= 0 ? "✅ At/Above Target" : "⬇️ Below Target";
    })();
    const targetClass = (() => {
      if (target == null || current == null || target === 0) return "";
      if (current >= target) return "text-green-600 font-medium";
      return "text-amber-600 font-medium";
    })();

    return (
      <tr className="hover:bg-gray-50">
        <td className="p-2 border font-medium">
          <Link href={`/stocks/${id}`} className="brand-link underline">
            {ticker}
          </Link>
        </td>
        <td className="p-2 border">{fmt(entry)}</td>
        <td className="p-2 border">{fmt(target)}</td>
        <FairTargetCell t={ticker} entry={entry} target={target} />
        <FairValueCell t={ticker} />
        <FairEtaCell t={ticker} entry={entry} target={target} />
        <AnalystFairCell t={ticker} />
        <FundamentalFairCell t={ticker} />
        <EtaDaysCell t={ticker} current={current} entry={entry} target={target} />
        <RiskCell t={ticker} entry={entry} target={target} />
        <td className="p-2 border">{fmt(targetPct)}</td>
        <td
          className="p-2 border"
          title={current != null && current > 0 && target != null ? `(( ${fmt(target)} - ${fmt(current)} ) / ${fmt(current)} ) * 100` : ""}
        >
          {fmt(remainingPct)}
        </td>
        <td className="p-2 border bg-brand-soft">{fmt(current)}</td>
        <td className="p-2 border whitespace-nowrap">
          <Momentum5m t={ticker} />
        </td>
        <td className="p-2 border whitespace-nowrap">
          <SwingBadge t={ticker} />
        </td>
        <td className="p-2 border whitespace-nowrap">
          <TechChip t={ticker} />
        </td>
        <td className="p-2 border whitespace-nowrap">
          <NewsChip t={ticker} />
        </td>
        <td
          className={`p-2 border ${
            earningsPct == null
              ? ""
              : earningsPct >= 0
              ? "bg-green-100 font-medium"
              : "bg-red-100 font-medium"
          }`}
        >
          {fmt(earningsPct)}
        </td>
        <td className="p-2 border"><RVOLVWAP t={ticker} /></td>
        <GoodBuyCell t={ticker} />
        <td className="p-2 border whitespace-nowrap">{entryStatus}</td>
        <td className={`p-2 border whitespace-nowrap ${targetClass}`}>{targetStatus}</td>
        <td className="p-2 border">
          <Buzz t={ticker} />
        </td>
        <td className="p-2 border">
          <News t={ticker} />
        </td>
        <td className="p-2 border">{ymd(openedAt)}</td>
        <td className="p-2 border whitespace-nowrap">
          {openedById ? (
            <Link href={`/analysts/${openedById}`} className="underline">
              {(openedBy ?? openedById).split("@")[0]}
            </Link>
          ) : (
            (openedBy ?? "-").split("@")[0]
          )}
        </td>
      </tr>
    );
  }
);

OpenCallRow.displayName = "OpenCallRow";

export default OpenCallRow;
