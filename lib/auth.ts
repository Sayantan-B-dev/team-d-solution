import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { db } from "./db";
import { isSecureRequest } from "./request";

export const SESSION_COOKIE = "sw_session";
export const OAUTH_STATE_COOKIE = "sw_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type UserRole = "user" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  role: UserRole;
};

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  picture?: string;
};

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET or GOOGLE_CLIENT_SECRET must be set.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "Google user",
      avatarUrl: typeof payload.avatarUrl === "string" ? payload.avatarUrl : null,
      role: payload.role === "admin" ? "admin" : "user",
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireUser(req: NextRequest): Promise<SessionUser | null> {
  return readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    // Follow the actual protocol, not NODE_ENV: `next start` over http://localhost
    // must still be able to store the session cookie.
    secure: isSecureRequest(req),
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function upsertUser(profile: GoogleProfile): Promise<SessionUser> {
  const result = await db<{
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
    role: string;
  }>(
    `insert into users (google_sub, email, name, avatar_url)
     values ($1, $2, $3, $4)
     on conflict (google_sub) do update
       set email = excluded.email,
           name = excluded.name,
           avatar_url = excluded.avatar_url
     returning id, email, name, avatar_url, role`,
    [profile.sub, profile.email, profile.name, profile.picture ?? null]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? row.email,
    avatarUrl: row.avatar_url,
    role: row.role === "admin" ? "admin" : "user",
  };
}

/**
 * Admin routes re-check the role in the database so promoting or demoting a
 * user takes effect without waiting for their session to expire.
 */
export async function requireAdmin(req: NextRequest): Promise<SessionUser | null> {
  const user = await requireUser(req);
  if (!user) return null;

  const result = await db<{ role: string }>("select role from users where id = $1", [user.id]);
  if (result.rows[0]?.role !== "admin") return null;

  return { ...user, role: "admin" };
}
