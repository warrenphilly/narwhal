import { NextResponse } from "next/server";
import { loadSeasons } from "@/lib/jellyfin-library";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const items = await loadSeasons(session, id);
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load seasons." },
      { status: 502 }
    );
  }
}
