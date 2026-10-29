import { NextResponse } from "next/server";

export function apiError(
  status: number,
  error: string,
  message: string,
  headers?: Record<string, string>
) {
  return NextResponse.json({ error, message }, { status, headers });
}
