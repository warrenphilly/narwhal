import { NextRequest, NextResponse } from "next/server";
import { authHeader, getSession } from "@/lib/session";
import { isDemoId } from "@/lib/demo-library";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await context.params;
  if (isDemoId(itemId)) {
    return NextResponse.json(
      { error: "Sample titles cannot be downloaded. Connect your Jellyfin server." },
      { status: 400 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const filename = request.nextUrl.searchParams.get("filename") || "movie.bin";
  const url = `${session.serverUrl}/Items/${encodeURIComponent(itemId)}/Download`;
  const upstream = await jellyfinFetch(
    url,
    { headers: { Authorization: authHeader(session) } },
    tunnelFromSession(session)
  );

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      {
        error:
          upstream.status === 401 || upstream.status === 403
            ? "This account is not allowed to download. Enable downloads for your user in the Jellyfin dashboard."
            : text.slice(0, 240) || "Download failed.",
      },
      { status: upstream.status || 502 }
    );
  }

  const headers = new Headers();
  const type = upstream.headers.get("content-type") || "application/octet-stream";
  const length = upstream.headers.get("content-length");
  headers.set("Content-Type", type);
  if (length) headers.set("Content-Length", length);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filename.replace(/"/g, "")}"`
  );
  headers.set("Cache-Control", "no-store");

  return new NextResponse(upstream.body, { status: 200, headers });
}
