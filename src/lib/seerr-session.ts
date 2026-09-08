import { cookies } from "next/headers";
import { normalizeServerUrl } from "@/lib/session";

export const SEERR_COOKIE = "seerr_session";

export type SeerrSession = {
  serverUrl: string;
  apiKey: string;
  allowInsecure?: boolean;
};

export function normalizeSeerrUrl(input: string) {
  return normalizeServerUrl(input);
}

export function seerrCookieValue(session: SeerrSession) {
  return JSON.stringify(session);
}

export async function getSeerrSession(): Promise<SeerrSession | null> {
  const store = await cookies();
  const raw = store.get(SEERR_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SeerrSession;
    if (!parsed.serverUrl || !parsed.apiKey) return null;
    return parsed;
  } catch {
    return null;
  }
}
