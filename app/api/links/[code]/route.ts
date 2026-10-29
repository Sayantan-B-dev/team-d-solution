import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { invalidateCache } from "@/lib/data-cache";
import { db } from "@/lib/db";
import { invalidateRedirect } from "@/lib/redirect-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await requireUser(req);
  if (!user) {
    return apiError(401, "unauthorized", "Sign in to manage your links.");
  }

  const { code } = await params;

  try {
    const result = await db("delete from links where code = $1 and user_id = $2", [code, user.id]);
    if (result.rowCount === 0) {
      return apiError(404, "not_found", "Link not found.");
    }

    invalidateRedirect(code);
    invalidateCache(`links:${user.id}`);
    invalidateCache(`stats:${user.id}:`);
    invalidateCache("admin:");

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Could not delete link:", error instanceof Error ? error.message : "unknown error");
    return apiError(500, "database_error", "Could not delete the link. Please try again.");
  }
}
