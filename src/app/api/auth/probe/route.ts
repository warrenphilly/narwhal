import { NextResponse } from "next/server";
import { normalizeServerUrl } from "@/lib/session";
import {
  describeConnectError,
  isTailscaleHost,
  jellyfinFetch,
  looksLikeCloudflareAccess,
} from "@/lib/jellyfin-request";

export async function POST(request: Request) {
  let serverUrl = "";
  try {
    const body = (await request.json()) as {
      serverUrl?: string;
      allowInsecure?: boolean;
      cfAccessClientId?: string;
      cfAccessClientSecret?: string;
      cfAccessJwt?: string;
    };
    serverUrl = normalizeServerUrl(body.serverUrl ?? "");
    const response = await jellyfinFetch(
      `${serverUrl}/System/Info/Public`,
      { method: "GET" },
      {
        allowInsecure: Boolean(body.allowInsecure),
        cfAccessClientId: body.cfAccessClientId?.trim() || undefined,
        cfAccessClientSecret: body.cfAccessClientSecret?.trim() || undefined,
        cfAccessJwt: body.cfAccessJwt?.trim() || undefined,
        timeoutMs: isTailscaleHost(new URL(serverUrl).hostname) ? 20000 : 12000,
      }
    );
    const text = await response.text();
    if (looksLikeCloudflareAccess(response, text)) {
      return NextResponse.json({
        ok: false,
        accessWall: true,
        message:
          "The tunnel is up, but Cloudflare Access is asking for an email code. Cinema cannot complete that page. Create a Service Token in Zero Trust and paste it here, or paste CF_Authorization after you approve the email once in a browser.",
      });
    }
    if (!response.ok) {
      return NextResponse.json({
        ok: false,
        message: `Reached the URL, but got HTTP ${response.status}.`,
      });
    }
    const info = JSON.parse(text) as { ServerName?: string; Version?: string };
    return NextResponse.json({
      ok: true,
      message: `Reached Jellyfin${info.ServerName ? ` “${info.ServerName}”` : ""}${info.Version ? ` (${info.Version})` : ""}. You can sign in.`,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      message: describeConnectError(error, serverUrl || "that URL"),
    });
  }
}
