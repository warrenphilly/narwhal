import { NextRequest, NextResponse } from "next/server";
import { loadLibrary } from "@/lib/jellyfin-library";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const type = request.nextUrl.searchParams.get("type") === "Series" ? "Series" : "Movie";
  try {
    const payload = await loadLibrary(session, type);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the library." },
      { status: 502 }
    );
  }
}
