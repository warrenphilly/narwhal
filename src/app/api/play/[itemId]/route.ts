import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
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

  const target = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/stream`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  headers.set("Authorization", authHeader(session));

  const upstream = await jellyfinFetch(
    target.toString(),
    { method: request.method, headers, redirect: "follow" },
    { ...tunnelFromSession(session) }
  );

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      out.set(key, value);
    }
  });
  if (!out.has("Accept-Ranges") && target.searchParams.get("static") === "true") {
    out.set("Accept-Ranges", "bytes");
  }
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
