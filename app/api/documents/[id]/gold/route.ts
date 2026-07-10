import { NextResponse } from "next/server";
import { readGoldLabel } from "@/lib/benchmark";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const gold = readGoldLabel(id);
  if (!gold) return NextResponse.json({ error: "Gold label unavailable." }, { status: 404 });
  return NextResponse.json(gold);
}
