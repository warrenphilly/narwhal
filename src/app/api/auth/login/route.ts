import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  authHeader,
  normalizeServerUrl,
  sessionCookieValue,
  type JellyfinSession,
} from "@/lib/session";
import {
  describeConnectError,
  jellyfinFetch,
  looksLikeCloudflareAccess,
  type TunnelAuth,
} from "@/lib/jellyfin-request";
import type { JellyfinAuthResult } from "@/lib/jellyfin-types";

type LoginBody = {
  serverUrl?: string;
  username?: string;
  password?: string;
  allowInsecure?: boolean;
  cfAccessClientId?: string;
  cfAccessClientSecret?: string;
  cfAccessJwt?: string;
};

function tunnelFromBody(body: LoginBody): TunnelAuth {
  return {
    allowInsecure: Boolean(body.allowInsecure),
    cfAccessClientId: body.cfAccessClientId?.trim() || undefined,
    cfAccessClientSecret: body.cfAccessClientSecret?.trim() || undefined,
    cfAccessJwt: body.cfAccessJwt?.trim() || undefined,
  };
}

export async function POST(request: Request) {
  let serverUrl = "";
  try {
    const body = (await request.json()) as LoginBody;
    serverUrl = normalizeServerUrl(body.serverUrl ?? "");
    const username = (body.username ?? "").trim();
    const password = body.password ?? "";
    const tunnel = tunnelFromBody(body);
    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const probe = await jellyfinFetch(
      `${serverUrl}/System/Info/Public`,
      { method: "GET" },
      { ...tunnel, timeoutMs: 12000 }
    );
    const probeText = await probe.text();
    if (looksLikeCloudflareAccess(probe, probeText)) {
      return NextResponse.json(
        {
          error:
            "Cloudflare Access stopped the request (email code wall). Add a Cloudflare service token in Cinema, or paste a CF_Authorization cookie after you sign in once in the browser.",
        },
        { status: 401 }
      );
    }
    if (!probe.ok) {
      return NextResponse.json(
        {
          error: `Reached ${serverUrl}, but the server answered ${probe.status}. Check the tunnel URL.`,
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
      { ...tunnel, timeoutMs: 15000 }
    );

    const authText = await response.text();
    if (looksLikeCloudflareAccess(response, authText)) {
      return NextResponse.json(
        {
          error:
            "Cloudflare Access blocked sign-in. Cinema cannot type the email code — use a service token or a CF_Authorization cookie.",
        },
        { status: 401 }
      );
    }

    if (!response.ok) {
      const message =
        response.status === 401
          ? "Wrong username or password."
          : `Jellyfin returned ${response.status}. ${authText.slice(0, 180)}`;
      return NextResponse.json({ error: message }, { status: 401 });
    }

    const data = JSON.parse(authText) as JellyfinAuthResult;
    const session: JellyfinSession = {
      serverUrl,
      token: data.AccessToken,
      userId: data.User.Id,
      userName: data.User.Name,
      deviceId,
      allowInsecure: tunnel.allowInsecure,
      cfAccessClientId: tunnel.cfAccessClientId,
      cfAccessClientSecret: tunnel.cfAccessClientSecret,
      cfAccessJwt: tunnel.cfAccessJwt,
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
