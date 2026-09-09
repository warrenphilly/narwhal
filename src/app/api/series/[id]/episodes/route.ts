import { NextRequest, NextResponse } from "next/server";
import { loadEpisodes } from "@/lib/jellyfin-library";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await context.params;
  const seasonId = request.nextUrl.searchParams.get("seasonId") || undefined;
  try {
    const items = await loadEpisodes(session, id, seasonId);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load episodes." },
      { status: 502 }
    );
  }
}
