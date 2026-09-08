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

type Body = {
  serverUrl?: string;
  token?: string;
  userId?: string;
  userName?: string;
  deviceId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const serverUrl = normalizeServerUrl(body.serverUrl ?? "");
    const token = body.token?.trim() ?? "";
    const userId = body.userId?.trim() ?? "";
    const deviceId = body.deviceId?.trim() || `narwhal-${Date.now()}`;
    if (!token || !userId) {
      return NextResponse.json({ error: "Missing Jellyfin session." }, { status: 400 });
    }

    const session: JellyfinSession = {
      serverUrl,
      token,
      userId,
      userName: body.userName?.trim() || "User",
      deviceId,
    };

    const probe = await jellyfinFetch(
      `${serverUrl}/Users/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: { Authorization: authHeader(session) },
      },
      { timeoutMs: 12000 }
    );
    if (!probe.ok) {
      return NextResponse.json({ error: "Jellyfin rejected this session." }, { status: 401 });
    }

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
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not keep you signed in." },
      { status: 502 }
    );
  }
}
