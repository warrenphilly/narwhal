import { NextResponse } from "next/server";
import { jellyfinFetch } from "@/lib/jellyfin-request";
import {
  SEERR_COOKIE,
  getSeerrSession,
  normalizeSeerrUrl,
  seerrCookieValue,
  type SeerrSession,
} from "@/lib/seerr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSeerrSession();
  if (!session) return NextResponse.json({ connected: false });
  return NextResponse.json({ connected: true, serverUrl: session.serverUrl });
}

export async function DELETE() {
  const res = NextResponse.json({ connected: false });
  res.cookies.set(SEERR_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      serverUrl?: string;
      apiKey?: string;
      allowInsecure?: boolean;
    };
    const serverUrl = normalizeSeerrUrl(body.serverUrl ?? "");
    const apiKey = (body.apiKey ?? "").trim();
    if (!apiKey) {
      return NextResponse.json({ error: "Paste your Seerr API key." }, { status: 400 });
    }

    const headers = { "X-Api-Key": apiKey, Accept: "application/json" };
    const tunnel = { allowInsecure: Boolean(body.allowInsecure), timeoutMs: 12_000 };
    const probe = await jellyfinFetch(`${serverUrl}/api/v1/request?take=1`, { headers }, tunnel);
    const text = await probe.text();
    if (!probe.ok) {
      return NextResponse.json(
        { error: text.slice(0, 180) || `Seerr answered ${probe.status}. Check the URL and API key.` },
        { status: 502 }
      );
    }

    const session: SeerrSession = {
      serverUrl,
      apiKey,
      allowInsecure: Boolean(body.allowInsecure),
    };
    const res = NextResponse.json({ connected: true, serverUrl });
    res.cookies.set(SEERR_COOKIE, seerrCookieValue(session), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reach Seerr." },
      { status: 502 }
    );
  }
}
