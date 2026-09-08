import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";
import { resolveJellyfinPlayUrl } from "@/lib/jellyfin-play";

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

async function play(request: NextRequest, itemId: string) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const auth = session;

  const preferTranscode = request.nextUrl.searchParams.get("transcode") === "1";
  const hardTranscode = request.nextUrl.searchParams.get("hard") === "1";
  const audioRaw = request.nextUrl.searchParams.get("audio");
  const audioIndex = audioRaw && audioRaw !== "off" ? Number(audioRaw) : undefined;
  const startRaw = Number(request.nextUrl.searchParams.get("startTicks") ?? 0);
  const startTicks = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : 0;
  const audio = Number.isFinite(audioIndex) ? audioIndex : undefined;

  async function openStream(transcode: boolean, hard: boolean, start: number) {
    const target = await resolveJellyfinPlayUrl(auth, itemId, transcode, audio, start, hard);
    const direct = /[?&]static=true/i.test(target);
    const headers = new Headers();
    const range = request.headers.get("range");
    if (range && direct && start === 0) headers.set("Range", range);
    headers.set("Authorization", authHeader(auth));
    headers.set("Accept-Encoding", "identity");
    const response = await jellyfinFetch(target, { method: "GET", headers, redirect: "follow" }, { ...tunnelFromSession(auth) });
    return { response, direct };
  }

  let upstream: Response;
  let direct = false;
  try {
    const first = await openStream(preferTranscode, hardTranscode, startTicks);
    upstream = first.response;
    direct = first.direct;
    if (!upstream.ok && upstream.status !== 206 && startTicks > 0) {
      const retry = await openStream(preferTranscode, hardTranscode, 0);
      upstream = retry.response;
      direct = retry.direct;
    }
    if (!upstream.ok && upstream.status !== 206 && !hardTranscode) {
      const retry = await openStream(true, true, 0);
      upstream = retry.response;
      direct = retry.direct;
    }
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
  if (!out.has("Content-Type")) out.set("Content-Type", "video/mp4");
  out.set("Cache-Control", "no-store");
  if (direct) out.set("Accept-Ranges", "bytes");
  else {
    out.delete("Accept-Ranges");
    out.set("Accept-Ranges", "none");
  }

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
