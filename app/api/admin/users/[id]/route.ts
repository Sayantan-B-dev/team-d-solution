import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireAdmin, requireUser, type SessionUser } from "@/lib/auth";
import { invalidateCache } from "@/lib/data-cache";
import { db, withTransaction } from "@/lib/db";
import { isUuid } from "@/lib/links";
import { invalidateRedirect } from "@/lib/redirect-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function guard(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await requireUser(req);
  if (!user) return apiError(401, "unauthorized", "Sign in to manage users.");
  const admin = await requireAdmin(req);
  if (!admin) return apiError(403, "forbidden", "Admin access is required.");
  return admin;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await guard(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  if (!isUuid(id)) return apiError(400, "invalid_user_id", "That user id is not valid.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(400, "invalid_json", "Send a JSON body.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return apiError(400, "invalid_body", "Send a JSON object.");
  }

  const { role } = body as Record<string, unknown>;
  if (role !== "user" && role !== "admin") {
    return apiError(400, "invalid_role", "Role must be either user or admin.");
  }

  try {
    const result = await withTransaction(async (client) => {
      // Serialize role changes so two demotions cannot remove every admin.
      await client.query("select pg_advisory_xact_lock(hashtext('sw_admins'))");

      const target = await client.query<{ role: string }>(
        "select role from users where id = $1 for update",
        [id]
      );

      if (target.rowCount === 0) return { status: 404 as const };

      if (role === "user" && target.rows[0].role === "admin") {
        const admins = await client.query<{ n: number }>(
          "select count(*)::int as n from users where role = 'admin'"
        );
        if ((admins.rows[0]?.n ?? 0) <= 1) return { status: 409 as const };
      }

      await client.query("update users set role = $1 where id = $2", [role, id]);
      return { status: 200 as const };
    });

    if (result.status === 404) return apiError(404, "not_found", "User not found.");
    if (result.status === 409) {
      return apiError(409, "last_admin", "At least one admin account is required.");
    }

    invalidateCache("admin:");
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    console.error("Admin user update failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not update the user.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await guard(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  if (!isUuid(id)) return apiError(400, "invalid_user_id", "That user id is not valid.");
  if (id === gate.id) {
    return apiError(400, "cannot_delete_self", "You cannot delete your own admin account.");
  }

  try {
    const codes = await db<{ code: string }>("select code from links where user_id = $1", [id]);
    const result = await db("delete from users where id = $1", [id]);

    if (result.rowCount === 0) return apiError(404, "not_found", "User not found.");

    for (const row of codes.rows) {
      invalidateRedirect(row.code);
      invalidateCache(`stats:${id}:`);
    }
    invalidateCache(`links:${id}`);
    invalidateCache("admin:");

    return NextResponse.json({ ok: true, deletedLinks: codes.rowCount ?? 0 });
  } catch (error) {
    console.error("Admin user delete failed:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not delete the user.");
  }
}
