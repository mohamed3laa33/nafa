
"use client";

import HitsCallRow from "./HitsCallRow";
import { ClosedCallNorm } from "../types";

interface HitsCallsTableProps {
  rows: ClosedCallNorm[];
}

export default function HitsCallsTable({ rows }: HitsCallsTableProps) {
  return (
    <div className="nf-table-wrap overflow-x-auto rounded">
      <table className="nf-table text-sm text-center">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2 border">Stock Ticker</th>
            <th className="p-2 border">Analyst</th>
            <th className="p-2 border">Entry</th>
            <th className="p-2 border">Target</th>
            <th className="p-2 border">Opened</th>
            <th className="p-2 border">Closed</th>
            <th className="p-2 border">Result %</th>
            <th className="p-2 border">Hit</th>
            <th className="p-2 border">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <HitsCallRow key={row.id} {...row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
