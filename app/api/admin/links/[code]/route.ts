import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireAdmin, requireUser, type SessionUser } from "@/lib/auth";
import { invalidateCache } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { isCodeShape, parseExpiry } from "@/lib/links";
import { invalidateRedirect } from "@/lib/redirect-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await requireUser(req);
  if (!user) return apiError(401, "unauthorized", "Sign in to manage links.");
  const admin = await requireAdmin(req);
  if (!admin) return apiError(403, "forbidden", "Admin access is required.");
  return admin;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const gate = await guard(req);
  if (gate instanceof NextResponse) return gate;

  const { code } = await params;
  if (!isCodeShape(code)) return apiError(400, "invalid_code", "That link code is not valid.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Send a JSON body.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError(400, "invalid_body", "Send a JSON object.");
  }

  const { expiresAt } = body as Record<string, unknown>;
  if (!("expiresAt" in (body as Record<string, unknown>))) {
    return apiError(400, "missing_expiry", "Send expiresAt as an ISO date or null.");
  }

  const parsed = parseExpiry(expiresAt);
  if (!parsed.ok) return apiError(400, "invalid_expiry", parsed.message);

  try {
    const result = await db<{ user_id: string }>(
      "update links set expires_at = $1 where code = $2 returning user_id",
      [parsed.expiresAt, code]
    );

    if (result.rowCount === 0) return apiError(404, "not_found", "Link not found.");

    invalidateRedirect(code);
    invalidateCache(`links:${result.rows[0].user_id}`);
    invalidateCache(`stats:${result.rows[0].user_id}:`);
    invalidateCache("admin:");

    return NextResponse.json({ ok: true, expiresAt: parsed.expiresAt });
  } catch (error) {
    console.error("Admin link update failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not update the link.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const gate = await guard(req);
  if (gate instanceof NextResponse) return gate;

  const { code } = await params;
  if (!isCodeShape(code)) return apiError(400, "invalid_code", "That link code is not valid.");

  try {
    const result = await db<{ user_id: string }>(
      "delete from links where code = $1 returning user_id",
      [code]
    );

    if (result.rowCount === 0) return apiError(404, "not_found", "Link not found.");

    invalidateRedirect(code);
    invalidateCache(`links:${result.rows[0].user_id}`);
    invalidateCache(`stats:${result.rows[0].user_id}:`);
    invalidateCache("admin:");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin link delete failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not delete the link.");
  }
}
