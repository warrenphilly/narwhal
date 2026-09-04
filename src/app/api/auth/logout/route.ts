import { NextResponse } from "next/server";
import { SESSION_COOKIE, authHeader, getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  if (session) {
    try {
      await fetch(`${session.serverUrl}/Sessions/Logout`, {
        method: "POST",
        headers: { Authorization: authHeader(session) },
      });
    } catch {
      // Ignore remote logout failures; still clear the local session.
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
