
"use client";

import ClosedCallRow from "./ClosedCallRow";
import { ClosedCallNorm } from "../types";

interface ClosedCallsTableProps {
  rows: ClosedCallNorm[];
}

export default function ClosedCallsTable({ rows }: ClosedCallsTableProps) {
  return (
    <div className="nf-table-wrap overflow-x-auto rounded">
      <table className="nf-table text-sm text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Stock Ticker</th>
            <th className="p-2 border">Analyst</th>
            <th className="p-2 border">Entry</th>
            <th className="p-2 border">Target</th>
            <th className="p-2 border">Stop Loss</th>
            <th className="p-2 border">Opened</th>
            <th className="p-2 border">Closed</th>
            <th className="p-2 border">Outcome</th>
            <th className="p-2 border">Result %</th>
            <th className="p-2 border">Current Price</th>
            <th className="p-2 border">Trend</th>
            <th className="p-2 border">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ClosedCallRow key={row.id} {...row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
