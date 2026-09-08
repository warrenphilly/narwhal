import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const skipRequest = new Set([
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
  "content-length",
  "accept-encoding",
  "origin",
  "referer",
]);

const skipResponse = new Set([
  ...skipRequest,
  "set-cookie",
  "content-encoding",
]);

async function proxy(request: NextRequest, path: string[]) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const joined = path.map(encodeURIComponent).join("/");
  const target = new URL(`${session.serverUrl}/${joined}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  const accept = request.headers.get("accept");
  if (accept) headers.set("Accept", accept);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  headers.set("Authorization", authHeader(session));
  headers.set("Accept-Encoding", "identity");

  try {
    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";
    const isImage = joined.includes("/Images/");
    const upstream = await jellyfinFetch(
      target.toString(),
      {
        method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: "follow",
      },
      { ...tunnelFromSession(session), timeoutMs: isImage ? 20_000 : 30_000 }
    );

    const out = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!skipResponse.has(key.toLowerCase())) {
        out.set(key, value);
      }
    });
    if (isImage) out.set("Cache-Control", "public, max-age=86400");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: out,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Jellyfin request failed." },
      { status: 502 }
    );
  }
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return proxy(request, path);
}
