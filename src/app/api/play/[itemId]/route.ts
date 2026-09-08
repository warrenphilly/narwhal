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

function streamTarget(serverUrl: string, itemId: string, transcode: boolean) {
  const target = new URL(`${serverUrl}/Videos/${encodeURIComponent(itemId)}/stream.mp4`);
  if (transcode) {
    target.searchParams.set("Container", "mp4");
    target.searchParams.set("VideoCodec", "h264");
    target.searchParams.set("AudioCodec", "aac");
    target.searchParams.set("AudioBitrate", "192000");
    target.searchParams.set("VideoBitrate", "8000000");
    target.searchParams.set("MaxStreamingBitrate", "12000000");
    target.searchParams.set("TranscodingProtocol", "http");
  } else {
    target.searchParams.set("static", "true");
    target.searchParams.set("Static", "true");
  }
  return target;
}

export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Type": "video/mp4",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const { itemId } = await context.params;
  const transcode = request.nextUrl.searchParams.get("transcode") === "1";
  const target = streamTarget(session.serverUrl, itemId, transcode);

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  headers.set("Authorization", authHeader(session));

  const upstream = await jellyfinFetch(
    target.toString(),
    { method: "GET", headers, redirect: "follow" },
    { ...tunnelFromSession(session) }
  );

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

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
