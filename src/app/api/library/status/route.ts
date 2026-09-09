import { NextResponse } from "next/server";
import { authHeader, getRequestSession } from "@/lib/session";
import { jellyfinFetch, tunnelFromSession } from "@/lib/jellyfin-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readJson(session: NonNullable<Awaited<ReturnType<typeof getSession>>>, path: string) {
  const response = await jellyfinFetch(
    `${session.serverUrl}/${path}`,
    {
      method: "GET",
      headers: {
        Authorization: authHeader(session),
        "X-Emby-Token": session.token,
        Accept: "application/json",
      },
    },
    { ...tunnelFromSession(session), timeoutMs: 15_000 }
  );
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text.slice(0, 160) };
    }
  }
  return { status: response.status, ok: response.ok, data, bytes: text.length };
}

function itemsOf(data: unknown): { name?: string; type?: string; collectionType?: string; id?: string }[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? ((data as { Items?: unknown[] }).Items ?? [])
      : [];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    const item = (row || {}) as Record<string, unknown>;
    return {
      id: item.Id ? String(item.Id) : undefined,
      name: item.Name ? String(item.Name) : undefined,
      type: item.Type ? String(item.Type) : undefined,
      collectionType: item.CollectionType ? String(item.CollectionType) : undefined,
    };
  });
}

function totalOf(data: unknown) {
  if (data && typeof data === "object" && typeof (data as { TotalRecordCount?: unknown }).TotalRecordCount === "number") {
    return (data as { TotalRecordCount: number }).TotalRecordCount;
  }
  return itemsOf(data).length;
}

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const user = encodeURIComponent(session.userId);
  const [views, root, series, movies, me] = await Promise.all([
    readJson(session, `Users/${user}/Views`).catch((error: unknown) => ({
      status: 0,
      ok: false,
      data: { error: error instanceof Error ? error.message : "Views failed" },
      bytes: 0,
    })),
    readJson(session, `Users/${user}/Items?Recursive=false&Limit=50`).catch((error: unknown) => ({
      status: 0,
      ok: false,
      data: { error: error instanceof Error ? error.message : "Root failed" },
      bytes: 0,
    })),
    readJson(session, `Users/${user}/Items?IncludeItemTypes=Series&Recursive=true&Limit=5`).catch((error: unknown) => ({
      status: 0,
      ok: false,
      data: { error: error instanceof Error ? error.message : "Series failed" },
      bytes: 0,
    })),
    readJson(session, `Users/${user}/Items?IncludeItemTypes=Movie&Recursive=true&Limit=5`).catch((error: unknown) => ({
      status: 0,
      ok: false,
      data: { error: error instanceof Error ? error.message : "Movies failed" },
      bytes: 0,
    })),
    readJson(session, `Users/${user}`).catch((error: unknown) => ({
      status: 0,
      ok: false,
      data: { error: error instanceof Error ? error.message : "User failed" },
      bytes: 0,
    })),
  ]);

  const policy =
    me.data && typeof me.data === "object"
      ? ((me.data as { Policy?: Record<string, unknown> }).Policy ?? {})
      : {};

  const enableAllFolders =
    typeof policy.EnableAllFolders === "boolean" ? policy.EnableAllFolders : null;

  return NextResponse.json({
    serverUrl: session.serverUrl,
    userId: session.userId,
    userName: session.userName,
    views: {
      status: views.status,
      count: itemsOf(views.data).length,
      total: totalOf(views.data),
      libraries: itemsOf(views.data),
    },
    root: {
      status: root.status,
      count: itemsOf(root.data).length,
      total: totalOf(root.data),
      items: itemsOf(root.data).slice(0, 12),
    },
    series: { status: series.status, total: totalOf(series.data), sample: itemsOf(series.data) },
    movies: { status: movies.status, total: totalOf(movies.data), sample: itemsOf(movies.data) },
    policy: {
      isAdministrator: Boolean(policy.IsAdministrator),
      enableAllFolders: enableAllFolders,
      enabledFolders: Array.isArray(policy.EnabledFolders) ? policy.EnabledFolders : [],
      enableAllChannels: policy.EnableAllChannels,
    },
  });
}
