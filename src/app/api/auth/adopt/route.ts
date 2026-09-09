import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authHeader,
  normalizeServerUrl,
  sessionCookieValue,
  sessionCookieOptions,
  type JellyfinSession,
} from "@/lib/session";
import { jellyfinFetch } from "@/lib/jellyfin-request";

export const runtime = "nodejs";

type Body = {
  serverUrl?: string;
  token?: string;
  userId?: string;
  userName?: string;
  deviceId?: string;
};

function sessionFromBody(body: Body): JellyfinSession | null {
  const serverUrl = normalizeServerUrl(body.serverUrl ?? "");
  const token = body.token?.trim() ?? "";
  const userId = body.userId?.trim() ?? "";
  const deviceId = body.deviceId?.trim() || `narwhal-${Date.now()}`;
  if (!token || !userId || !serverUrl) return null;
  return {
    serverUrl,
    token,
    userId,
    userName: body.userName?.trim() || "User",
    deviceId,
  };
}

function adoptResponse(session: JellyfinSession) {
  const res = NextResponse.json({
    signedIn: true,
    userName: session.userName,
    userId: session.userId,
    serverUrl: session.serverUrl,
    token: session.token,
    deviceId: session.deviceId,
  });
  res.cookies.set(SESSION_COOKIE, sessionCookieValue(session), sessionCookieOptions());
  return res;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const session = sessionFromBody(body);
    if (!session) {
      return NextResponse.json({ error: "Missing Jellyfin session." }, { status: 400 });
    }

    try {
      const probe = await jellyfinFetch(
        `${session.serverUrl}/Users/${encodeURIComponent(session.userId)}`,
        {
          method: "GET",
          headers: {
            Authorization: authHeader(session),
            "X-Emby-Token": session.token,
          },
        },
        { timeoutMs: 12000 }
      );
      // Never block adopt on probe — cookie is required for /api/jf library calls.
      // A false 401 here was leaving the UI “signed in” with an empty library.
      void probe;
    } catch {
      // Narwhal cloud often cannot reach home LAN / Tailscale.
    }

    return adoptResponse(session);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not keep you signed in." },
      { status: 502 }
    );
  }
}
