import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ signedIn: false });
  }
  return NextResponse.json({
    signedIn: true,
    userName: session.userName,
    userId: session.userId,
    serverUrl: session.serverUrl,
  });
}
