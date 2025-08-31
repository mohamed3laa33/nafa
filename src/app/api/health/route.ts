
import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export const runtime = "nodejs"; // or "edge"

export async function GET() {
  const isDbOk = await pingDb();
  if (isDbOk) {
    return NextResponse.json({ status: "ok" });
  } else {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
