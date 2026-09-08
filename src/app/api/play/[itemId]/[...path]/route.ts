import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import { resolveJellyfinHlsUrl } from "@/lib/jellyfin-play";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  "content-encoding",
]);

// Proxies everything an HLS session needs after the master playlist: the
// media playlist and every .ts segment. Jellyfin's playlists reference these
// with relative URLs, so the browser (via hls.js) requests them at this same
// /api/play/{itemId}/{...path} prefix — we just forward that path straight
// through to Jellyfin's /Videos/{itemId}/{...path}, query string untouched.
type RouteContext = { params: Promise<{ itemId: string; path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { itemId, path } = await context.params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const leaf = path[path.length - 1] ?? "";
  let target: string;

  if (path.length === 1 && leaf === "master.m3u8") {
    const audioRaw = request.nextUrl.searchParams.get("audio");
    const audioIndex = audioRaw && audioRaw !== "off" ? Number(audioRaw) : undefined;
    const startRaw = Number(request.nextUrl.searchParams.get("startTicks") ?? 0);
    const startTicks = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : 0;
    try {
      target = await resolveJellyfinHlsUrl(session, itemId, Number.isFinite(audioIndex) ? audioIndex : undefined, startTicks);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start HLS playback.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } else {
    const segments = path.map(encodeURIComponent).join("/");
    const url = new URL(`${session.serverUrl}/Videos/${encodeURIComponent(itemId)}/${segments}`);
    request.nextUrl.searchParams.forEach((value, key) => {
      if (key.toLowerCase() === "starttimeticks") return;
      url.searchParams.append(key, value);
    });
    target = url.toString();
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  headers.set("Authorization", authHeader(session));
  headers.set("Accept-Encoding", "identity");

  let upstream: Response;
  try {
    upstream = await jellyfinFetch(target, { method: "GET", headers, redirect: "follow" }, { ...tunnelFromSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reach the video stream.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    const detail = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: detail.slice(0, 300) || `Jellyfin stream failed (${upstream.status})` },
      { status: upstream.status || 502 }
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      out.set(key, value);
    }
  });
  if (leaf.endsWith(".m3u8") && !out.has("content-type")) {
    out.set("Content-Type", "application/vnd.apple.mpegurl");
  }
  out.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
