import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { jellyfinFetch } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function proxy(request: NextRequest, path: string[]) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const joined = path.map(encodeURIComponent).join("/");
  const target = new URL(`${session.serverUrl}/${joined}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Authorization", authHeader(session));
  headers.delete("content-length");

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
    { allowInsecure: session.allowInsecure, timeoutMs: 120_000 }
  );

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!hopByHop.has(key.toLowerCase()) && key.toLowerCase() !== "set-cookie") {
      out.set(key, value);
    }
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
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
