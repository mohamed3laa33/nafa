
"use client";

import Link from "next/link";
import { memo } from "react";
import { ClosedCallNorm } from "../types";
import { fnum, fdate } from "../utils";
import PriceSparkline from "@/components/PriceSparkline";

const ClosedCallRow = memo((props: ClosedCallNorm) => {
  return (
    <tr className="hover:bg-gray-50">
      <td className="p-2 border font-medium">
        <Link
          href={props.stock_id ? `/stocks/${props.stock_id}` : "#"}
          className="brand-link underline"
        >
          {props.ticker}
        </Link>
      </td>
      <td className="p-2 border whitespace-nowrap">
        {props.opened_by_id ? (
          <Link href={`/analysts/${props.opened_by_id}`} className="underline">
            {props.opened_by ?? props.opened_by_id}
          </Link>
        ) : (
          props.opened_by ?? "-"
        )}
      </td>
      <td className="p-2 border">{fnum(props.entry_price)}</td>
      <td className="p-2 border">{fnum(props.target_price)}</td>
      <td className="p-2 border">{fnum(props.stop_loss)}</td>
      <td className="p-2 border">{fdate(props.opened_at)}</td>
      <td className="p-2 border">{fdate(props.closed_at)}</td>
      <td className="p-2 border">{props.outcome ?? "-"}</td>
      <td
        className={`p-2 border ${
          props.result_pct == null
            ? ""
            : (props.result_pct as number) >= 0
            ? "text-green-600 font-medium"
            : "text-red-600 font-medium"
        }`}
      >
        {fnum(props.result_pct)}
      </td>
      <td className="p-2 border">{fnum(props.current_price)}</td>
      <td className="p-2 border">
        <PriceSparkline ticker={props.ticker} width={120} height={36} />
      </td>
      <td className="p-2 border">{props.note ?? "-"}</td>
    </tr>
  );
});

ClosedCallRow.displayName = "ClosedCallRow";

export default ClosedCallRow;
