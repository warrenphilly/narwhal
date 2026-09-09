import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ signedIn: false });
  }
  return NextResponse.json({
    signedIn: true,
    userName: session.userName,
    userId: session.userId,
    serverUrl: session.serverUrl,
    token: session.token,
    deviceId: session.deviceId,
  });
}
