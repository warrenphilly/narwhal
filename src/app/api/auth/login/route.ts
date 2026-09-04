import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authHeader,
  normalizeServerUrl,
  sessionCookieValue,
  type JellyfinSession,
} from "@/lib/session";
import { describeConnectError, jellyfinFetch } from "@/lib/jellyfin-request";
import type { JellyfinAuthResult } from "@/lib/jellyfin-types";

export async function POST(request: Request) {
  let serverUrl = "";
  try {
    const body = (await request.json()) as {
      serverUrl?: string;
      username?: string;
      password?: string;
      allowInsecure?: boolean;
    };
    serverUrl = normalizeServerUrl(body.serverUrl ?? "");
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const allowInsecure = Boolean(body.allowInsecure);
    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const probe = await jellyfinFetch(
      `${serverUrl}/System/Info/Public`,
      { method: "GET" },
      { allowInsecure, timeoutMs: 8000 }
    );
    if (!probe.ok) {
      return NextResponse.json(
        {
          error: `Reached ${serverUrl}, but Jellyfin answered ${probe.status}. Check the address and port.`,
        },
        { status: 502 }
      );
    }

    const deviceId =
      globalThis.crypto?.randomUUID?.() ?? `cinema-${Date.now()}`;
    const authUrl = `${serverUrl}/Users/AuthenticateByName`;
    const response = await jellyfinFetch(
      authUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader({ token: "", deviceId }),
        },
        body: JSON.stringify({ Username: username, Pw: password, Password: password }),
      },
      { allowInsecure, timeoutMs: 15000 }
    );

    if (!response.ok) {
      const text = await response.text();
      const message =
        response.status === 401
          ? "Wrong username or password."
          : `Jellyfin returned ${response.status}. ${text.slice(0, 180)}`;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const data = (await response.json()) as JellyfinAuthResult;
    const session: JellyfinSession = {
      serverUrl,
      token: data.AccessToken,
      userId: data.User.Id,
      userName: data.User.Name,
      deviceId,
      allowInsecure,
    };

    const res = NextResponse.json({
      userName: session.userName,
      userId: session.userId,
      serverUrl: session.serverUrl,
    });
    res.cookies.set(SESSION_COOKIE, sessionCookieValue(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (error) {
    const message = describeConnectError(error, serverUrl || "your Jellyfin server");
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
