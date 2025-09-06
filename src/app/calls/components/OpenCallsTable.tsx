
"use client";

import { useState, useEffect } from "react";
import OpenCallRow from "./OpenCallRow";
import { OpenRow } from "../types";

interface OpenCallsTableProps {
  rows: OpenRow[];
}

const defaultColW: Record<string, number> = {
  ticker: 120, entry: 90, target: 90, fairTarget: 110, fairValue: 110, analystFair: 110, fundamentalFair: 110, targetFit: 110,
  fairEta: 90, etaDays: 90, stop: 110, rToTgt: 100, targetPct: 130,
  remainPct: 150, current: 120, momentum: 120, swing: 110, tech: 140, newsSent: 140, earningsPct: 110,
  flow: 170, goodBuy: 110, entryStatus: 130, targetStatus: 130, buzz: 120, news: 120,
  openedAt: 140, analyst: 150
};

export default function OpenCallsTable({ rows }: OpenCallsTableProps) {
  const [colW, setColW] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try { const s = localStorage.getItem("callsColW"); if (s) return { ...defaultColW, ...JSON.parse(s) }; } catch {}
    }
    return defaultColW;
  });

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("callsColW", JSON.stringify(colW)); }, [colW]);

  const startResize = (col: string, startX: number) => {
    const startWidth = colW[col] || 100;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      setColW((prev) => ({ ...prev, [col]: Math.max(60, startWidth + dx) }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div className="nf-table-wrap overflow-x-auto rounded">
      <table className="nf-table text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border relative" style={{ width: colW.ticker }}>
              Stock Ticker
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("ticker", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.entry }}>
              Entry
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("entry", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.target }}>
              Target
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("target", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.fairTarget }}>
              Fair Target
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("fairTarget", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.fairValue }} title="VWAP/EMA/Channel Mid blend">
              Fair Value
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("fairValue", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.analystFair }} title="Yahoo target mean">
              Analyst Fair
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("analystFair", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.fundamentalFair }} title="Multiples-based heuristic">
              Fundamental Fair
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("fundamentalFair", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.targetFit }}>
              Target Fit
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("targetFit", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.fairEta }}>
              Fair ETA
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("fairEta", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.etaDays }}>
              ETA Days
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("etaDays", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.stop }}>
              Sugg Stop
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("stop", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.rToTgt }}>
              R to Tgt
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("rToTgt", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.targetPct }}>
              Target % (vs Entry)
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("targetPct", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.remainPct }} title="(target - current) / current * 100">
              Remain % (vs Current)
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("remainPct", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.current }}>
              Current Price
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("current", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.momentum }}>
              5m Momentum
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("momentum", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.swing }}>
              Swing
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("swing", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.tech }}>
              Tech
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("tech", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.newsSent }}>
              News Sent.
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("newsSent", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.earningsPct }}>
              Earnings %
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("earningsPct", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.flow }}>
              Flow/RVOL/VWAP
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("flow", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.goodBuy }} title="Discount to fair + risk checks">
              Good To Buy
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("goodBuy", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.entryStatus }}>
              Entry Status
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("entryStatus", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.targetStatus }}>
              Target Status
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("targetStatus", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.buzz }}>
              Latest Buzz
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("buzz", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.news }}>
              Latest News
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("news", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.openedAt }}>
              Entry Date
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("openedAt", e.clientX)} />
            </th>
            <th className="p-2 border relative" style={{ width: colW.analyst }}>
              Analyst
              <span className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none" onMouseDown={(e) => startResize("analyst", e.clientX)} />
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OpenCallRow key={row.id} {...row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
