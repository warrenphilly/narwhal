import { NextResponse } from "next/server";
import { authHeader, getRequestSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await context.params;
  const url = `${session.serverUrl}/Users/${encodeURIComponent(session.userId)}/Items/${encodeURIComponent(id)}`;
  const fields =
    "Overview,Genres,PrimaryImageAspectRatio,MediaSources,CanDownload,ProductionYear,DateCreated,PremiereDate,CommunityRating,CriticRating,OfficialRating,RunTimeTicks,ImageTags,BackdropImageTags,UserData,SeriesName,SeriesId,ParentIndexNumber,IndexNumber,People,Studios,RemoteTrailers,Taglines,Status,ProductionLocations,ChildCount,MediaStreams,Type,Name";
  try {
    const upstream = await jellyfinFetch(
      `${url}?Fields=${fields}`,
      { headers: { Authorization: authHeader(session) } },
      { ...tunnelFromSession(session), timeoutMs: 20_000 }
    );
    const text = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: text.slice(0, 200) || `Item failed (${upstream.status})` },
        { status: upstream.status }
      );
    }
    return new NextResponse(text || "{}", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load this title." },
      { status: 502 }
    );
  }
}
