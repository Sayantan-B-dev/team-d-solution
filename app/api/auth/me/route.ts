import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  return NextResponse.json({ user }, { headers: { "cache-control": "no-store" } });
}
