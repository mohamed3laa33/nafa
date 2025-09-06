import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toNum(v: any): number | null { const n = Number(v); return Number.isFinite(n) ? n : null; }

type DcfInputs = {
  years: number;                 // 5..10
  rev0: number;                  // current revenue
  cagr: number;                  // 0..1 (per year)
  fcfMarginStart: number;        // 0..1
  fcfMarginEnd: number;          // 0..1
  discount: number;              // 0..1
  terminalMethod: 'gordon' | 'exit';
  terminalG: number;             // 0..1 (gordon growth)
  exitMultiple?: number;         // EBITDA multiple when terminalMethod = 'exit'
  ebitdaMargin?: number;         // for exit multiple
  shares: number;                // shares outstanding
  netCash: number;               // cash - debt (can be negative)
};

function projectDcf(inp: DcfInputs) {
  const n = Math.max(5, Math.min(10, Math.round(inp.years)));
  const rev: number[] = new Array(n + 1).fill(0);
  rev[0] = inp.rev0;
  for (let i = 1; i <= n; i++) rev[i] = rev[i-1] * (1 + inp.cagr);
  const fcf: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const m = inp.fcfMarginStart + (i / Math.max(1, n - 1)) * (inp.fcfMarginEnd - inp.fcfMarginStart);
    fcf[i] = rev[i] * m; // simple conversion to FCF
  }
  // Terminal value at year n
  let terminalEV = 0;
  if (inp.terminalMethod === 'gordon') {
    const fcfNext = rev[n] * inp.fcfMarginEnd; // year n revenue has grown already
    terminalEV = (fcfNext * (1 + inp.terminalG)) / (inp.discount - inp.terminalG);
  } else {
    const ebitda = rev[n] * (inp.ebitdaMargin ?? inp.fcfMarginEnd);
    terminalEV = ebitda * (inp.exitMultiple ?? 15);
  }
  const r = 1 + inp.discount;
  let pv = 0;
  for (let i = 0; i < n; i++) pv += fcf[i] / Math.pow(r, i + 1);
  const pvTerminal = terminalEV / Math.pow(r, n);
  const equityValue = pv + pvTerminal + inp.netCash;
  const price = equityValue / inp.shares;
  return { rev, fcf, terminalEV, pvFcf: pv, pvTerminal, equityValue, price };
}

export async function POST(req: Request, ctx: { params: Promise<{ ticker: string }> }) {
  const requestId = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  try {
    const { ticker } = await ctx.params;
    const symbol = (ticker || '').toUpperCase();
    const b = await req.json().catch(()=>({}));

    const base: DcfInputs = {
      years: Math.max(5, Math.min(10, Number(b?.base?.years ?? 7))),
      rev0: toNum(b?.base?.rev0) ?? 0,
      cagr: Math.max(0, Number(b?.base?.cagr ?? 0.3)),
      fcfMarginStart: Math.max(0, Number(b?.base?.fcfMarginStart ?? 0.02)),
      fcfMarginEnd: Math.max(0, Number(b?.base?.fcfMarginEnd ?? 0.12)),
      discount: Math.max(0.01, Number(b?.base?.discount ?? 0.10)),
      terminalMethod: (String(b?.base?.terminalMethod || 'gordon') as any) === 'exit' ? 'exit' : 'gordon',
      terminalG: Math.max(0, Number(b?.base?.terminalG ?? 0.03)),
      exitMultiple: toNum(b?.base?.exitMultiple) ?? 15,
      ebitdaMargin: toNum(b?.base?.ebitdaMargin) ?? null as any,
      shares: Math.max(1, Number(b?.base?.shares ?? 1)),
      netCash: Number(b?.base?.netCash ?? 0),
    };
    const bull: Partial<DcfInputs> = b?.bull || {};
    const bear: Partial<DcfInputs> = b?.bear || {};

    // Helper to merge with reasonable scenario shifts if missing
    const shift = (src: Partial<DcfInputs>, sign: 1|-1): DcfInputs => ({
      years: base.years,
      rev0: base.rev0,
      cagr: src.cagr != null ? Number(src.cagr) : base.cagr + sign * 0.05,
      fcfMarginStart: src.fcfMarginStart != null ? Number(src.fcfMarginStart) : base.fcfMarginStart + sign * 0.01,
      fcfMarginEnd: src.fcfMarginEnd != null ? Number(src.fcfMarginEnd) : base.fcfMarginEnd + sign * 0.02,
      discount: src.discount != null ? Number(src.discount) : base.discount - sign * 0.01,
      terminalMethod: (src.terminalMethod as any) || base.terminalMethod,
      terminalG: src.terminalG != null ? Number(src.terminalG) : base.terminalG + sign * 0.005,
      exitMultiple: src.exitMultiple != null ? Number(src.exitMultiple) : (base.exitMultiple ?? 15) + sign * 2,
      ebitdaMargin: src.ebitdaMargin != null ? Number(src.ebitdaMargin) : (base.ebitdaMargin ?? base.fcfMarginEnd + 0.05),
      shares: base.shares,
      netCash: base.netCash,
    });

    const bullInp = shift(bull, +1);
    const bearInp = shift(bear, -1);

    const baseRes = projectDcf(base);
    const bullRes = projectDcf(bullInp);
    const bearRes = projectDcf(bearInp);

    return NextResponse.json({ requestId, ticker: symbol, base: baseRes, bull: bullRes, bear: bearRes, inputs: { base, bull: bullInp, bear: bearInp } });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed', requestId }, { status: 500 });
  }
}

