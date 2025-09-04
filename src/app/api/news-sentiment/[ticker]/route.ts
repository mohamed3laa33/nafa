import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function quickSentiment(text: string): number {
  // Very simple lexicon-based headline sentiment in [-1,1]
  const pos = [
    'beats','surge','soar','rally','upgrades','tops','win','growth','record','strong','bullish','profit','positive','optimistic','jump','rise','spike','surges'
  ];
  const neg = [
    'miss','plunge','tumble','downgrade','cuts','warns','lawsuit','loss','negative','bearish','drop','falls','fell','recall','probe','investigation','fraud','sec','ftc','doj'
  ];
  const s = text.toLowerCase();
  let score = 0;
  for (const w of pos) if (s.includes(w)) score += 1;
  for (const w of neg) if (s.includes(w)) score -= 1;
  return Math.max(-1, Math.min(1, score / 3));
}

function parseRssTitles(xml: string): { title: string; link: string }[] {
  const items: { title: string; link: string }[] = [];
  const reItem = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = reItem.exec(xml))) {
    const chunk = m[1];
    const t = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i.exec(chunk);
    const l = /<link>(.*?)<\/link>/i.exec(chunk);
    const title = (t?.[1] || t?.[2] || '').trim();
    const link = (l?.[1] || '').trim();
    if (title) items.push({ title, link });
  }
  return items;
}

export async function GET(_req: Request, ctx: { params: Promise<{ ticker: string }> | { ticker: string } }) {
  try {
    const p = 'then' in (ctx.params as any) ? await (ctx.params as Promise<{ ticker: string }>) : (ctx.params as { ticker: string });
    const t = decodeURIComponent(p.ticker).toUpperCase();
    if (!t) return NextResponse.json({ error: 'ticker required' }, { status: 400 });
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(t)}&hl=en-US&gl=US&ceid=US:en`;
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
    const xml = await r.text();
    const items = parseRssTitles(xml).slice(0, 10);
    const scored = items.map((k) => ({ ...k, score: quickSentiment(k.title) }));
    const agg = scored.length ? scored.reduce((a, b) => a + b.score, 0) / scored.length : 0;
    return NextResponse.json({ aggregate: agg, items: scored });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
