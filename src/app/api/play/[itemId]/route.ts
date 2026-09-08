import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { resolveJellyfinPlayUrl } from "@/lib/jellyfin-play";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 3600;

const hopByHop = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cookie",
]);

async function play(request: NextRequest, itemId: string) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const preferTranscode = request.nextUrl.searchParams.get("transcode") === "1";
  let target: string;
  try {
    target = await resolveJellyfinPlayUrl(session, itemId, preferTranscode);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not prepare playback.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  headers.set("Authorization", authHeader(session));

  const upstream = await jellyfinFetch(
    target,
    { method: request.method, headers, redirect: "follow" },
    { ...tunnelFromSession(session) }
  );

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      out.set(key, value);
    }
  });
  out.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { itemId } = await context.params;
  return play(request, itemId);
}

export async function HEAD(request: NextRequest, context: RouteContext) {
  const { itemId } = await context.params;
  return play(request, itemId);
}
