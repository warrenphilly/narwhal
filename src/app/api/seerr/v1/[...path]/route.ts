import { NextRequest, NextResponse } from "next/server";
import { jellyfinFetch } from "@/lib/jellyfin-request";
import { getSeerrSession } from "@/lib/seerr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const skip = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "set-cookie",
  "host",
]);

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: RouteContext) {
  const session = await getSeerrSession();
  if (!session) {
    return NextResponse.json({ error: "Connect Seerr first." }, { status: 401 });
  }

  const { path } = await context.params;
  const joined = path.map(encodeURIComponent).join("/");
  const target = new URL(`${session.serverUrl}/api/v1/${joined}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  headers.set("X-Api-Key", session.apiKey);
  headers.set("Accept", "application/json");
  headers.set("Accept-Encoding", "identity");
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);

  try {
    const method = request.method;
    const hasBody = method !== "GET" && method !== "HEAD";
    const upstream = await jellyfinFetch(
      target.toString(),
      {
        method,
        headers,
        body: hasBody ? await request.arrayBuffer() : undefined,
        redirect: "follow",
      },
      { allowInsecure: session.allowInsecure, timeoutMs: 30_000 }
    );
    const body = await upstream.arrayBuffer();
    const out = new Headers();
    upstream.headers.forEach((value, key) => {
      if (!skip.has(key.toLowerCase())) out.set(key, value);
    });
    if (!out.has("Content-Type")) out.set("Content-Type", "application/json");
    return new NextResponse(body, { status: upstream.status, headers: out });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Seerr request failed." },
      { status: 502 }
    );
  }
}
