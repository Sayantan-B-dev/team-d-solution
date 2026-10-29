import { NextResponse } from "next/server";
import { getPool, hasDatabase } from "./db";

export async function healthResponse() {
  let database = "not_configured";

  if (hasDatabase()) {
    try {
      await getPool().query("select 1");
      database = "up";
    } catch {
      database = "down";
    }
  }

  return NextResponse.json(
    {
      status: "ok",
      project: "dlinkit — Link Shortener + Analytics (Team D)",
      stack: "nextjs",
      database,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
