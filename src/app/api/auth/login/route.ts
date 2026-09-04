import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authHeader,
  normalizeServerUrl,
  sessionCookieValue,
  type JellyfinSession,
} from "@/lib/session";
import type { JellyfinAuthResult } from "@/lib/jellyfin-types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      serverUrl?: string;
      username?: string;
      password?: string;
    };
    const serverUrl = normalizeServerUrl(body.serverUrl ?? "");
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const deviceId =
      globalThis.crypto?.randomUUID?.() ?? `cinema-${Date.now()}`;
    const authUrl = `${serverUrl}/Users/AuthenticateByName`;
    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader({ token: "", deviceId }),
      },
      body: JSON.stringify({ Username: username, Pw: password, Password: password }),
    });

    if (!response.ok) {
      const text = await response.text();
      const message =
        response.status === 401
          ? "Wrong username or password."
          : `Could not reach Jellyfin (${response.status}). ${text.slice(0, 180)}`;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const data = (await response.json()) as JellyfinAuthResult;
    const session: JellyfinSession = {
      serverUrl,
      token: data.AccessToken,
      userId: data.User.Id,
      userName: data.User.Name,
      deviceId,
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
    const message =
      error instanceof Error ? error.message : "Sign-in failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
