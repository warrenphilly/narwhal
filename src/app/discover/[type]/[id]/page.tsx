"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PageBack } from "@/components/back-button";
import { LoginScreen } from "@/components/login-screen";
import { PageSpinner } from "@/components/narwhal-spinner";
import { SeerrRequestDialog } from "@/components/seerr-request-dialog";
import { PageHero } from "@/components/page-hero";
import { useSession } from "@/components/session-provider";
import {
  backdropUrl,
  formatMinutes,
  posterUrl,
  releaseTypeLabel,
  statusLabel,
  type SeerrSearchResult,
} from "@/lib/seerr";

type Detail = {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  runtime?: number;
  episodeRunTime?: number[];
  voteAverage?: number;
  voteCount?: number;
  status?: string;
  releaseDate?: string;
  firstAirDate?: string;
  posterPath?: string;
  backdropPath?: string;
  genres?: { id?: number; name?: string }[];
  mediaInfo?: SeerrSearchResult["mediaInfo"];
  releases?: {
    results?: { iso_3166_1?: string; release_dates?: { type?: number; release_date?: string; certification?: string }[] }[];
  };
  reviews?: { results?: { author?: string; content?: string }[] };
};

async function seerr<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/seerr/${path}`, { ...init, cache: "no-store", credentials: "same-origin" });
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data && "error" in data ? String(data.error) : "Could not load this title.");
  return data as T;
}

function releaseKinds(detail: Detail) {
  const rows = detail.releases?.results ?? [];
  const pick = rows.find((row) => row.iso_3166_1 === "US") ?? rows[0];
  const names = [...new Set((pick?.release_dates ?? []).map((row) => releaseTypeLabel(row.type)).filter(Boolean))];
  return names;
}

export default function DiscoverTitlePage() {
  const params = useParams<{ type: string; id: string }>();
  const { session, loading, preview } = useSession();
  const kind = params.type === "tv" ? "tv" : "movie";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    seerr<Detail>(`v1/${kind}/${id}`)
      .then(async (next) => {
        if (next.reviews?.results?.length) {
          setDetail(next);
          return;
        }
        const extra = await seerr<{ results?: { author?: string; content?: string }[] }>(`v1/${kind}/${id}/reviews`).catch(
          () => null
        );
        setDetail({ ...next, reviews: extra ? { results: extra.results ?? [] } : next.reviews });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load this title."));
  }, [kind, params.id]);

  const item = useMemo<SeerrSearchResult | null>(() => {
    if (!detail) return null;
    return {
      id: detail.id,
      mediaType: kind,
      title: detail.title || detail.name,
      name: detail.name,
      overview: detail.overview,
      posterPath: detail.posterPath,
      releaseDate: detail.releaseDate,
      firstAirDate: detail.firstAirDate,
      mediaInfo: detail.mediaInfo,
    };
  }, [detail, kind]);

  if (loading) return <PageSpinner label="Opening Discover…" />;
  if (!session?.signedIn && !preview) return <LoginScreen />;

  const title = detail?.title || detail?.name || "Untitled";
  const year = (detail?.releaseDate || detail?.firstAirDate || "").slice(0, 4);
  const runtime = formatMinutes(detail?.runtime || detail?.episodeRunTime?.[0]);
  const kinds = detail ? releaseKinds(detail) : [];
  const reviews = detail?.reviews?.results?.slice(0, 2) ?? [];
  const canRequest = !detail?.mediaInfo?.status || detail.mediaInfo.status < 2;
  const art = posterUrl(detail?.posterPath, "w500");
  const hero = backdropUrl(detail?.backdropPath);

  return (
    <AppShell>
      <PageHero
        art={
          hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="pointer-events-none absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-zinc-900" />
          )
        }
      >
        <PageBack className="text-white hover:bg-white/10" />
        {!detail && !error && <PageSpinner label="Finding this title…" />}
        {error && <p className="text-white/80">{error}</p>}
        {detail && (
          <div>
            <p className="text-xs tracking-[0.24em] text-white/80 uppercase">
              {kind === "tv" ? "Series" : "Movie"}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
              {year ? ` (${year})` : ""}
            </h1>
            <div className="mt-3 flex flex-wrap gap-2 text-sm text-white/85">
              {runtime && <span>{runtime}</span>}
              {detail.status && <span>{detail.status}</span>}
              {typeof detail.voteAverage === "number" && detail.voteAverage > 0 && (
                <span>
                  {detail.voteAverage.toFixed(1)} / 10
                  {detail.voteCount ? ` · ${detail.voteCount.toLocaleString()} reviews` : ""}
                </span>
              )}
              {statusLabel(detail.mediaInfo?.status) && <span>{statusLabel(detail.mediaInfo?.status)}</span>}
            </div>
          </div>
        )}
      </PageHero>
      <div className="page-gutter py-6">
        {detail && (
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="poster-case w-full max-w-[220px] overflow-hidden bg-zinc-800">
              {art ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art} alt="" className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="aspect-[2/3]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {kinds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {kinds.map((name) => (
                    <span key={name} className="rounded-full bg-black/5 px-3 py-1 text-xs dark:bg-white/10">
                      {name}
                    </span>
                  ))}
                </div>
              )}
              {detail.genres?.length ? (
                <p className="mt-3 text-sm text-zinc-500">{detail.genres.map((genre) => genre.name).filter(Boolean).join(" · ")}</p>
              ) : null}
              {detail.overview && <p className="mt-4 max-w-2xl text-base leading-relaxed">{detail.overview}</p>}
              {canRequest && (
                <Button className="mt-5 rounded-full" onClick={() => setOpen(true)}>
                  Request
                </Button>
              )}
              {reviews.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h2 className="text-lg font-semibold">Reviews</h2>
                  {reviews.map((review) => (
                    <blockquote key={review.author} className="rounded-2xl border border-black/8 p-4 text-sm dark:border-white/10">
                      <p className="line-clamp-5">{review.content}</p>
                      {review.author && <footer className="mt-2 text-xs text-zinc-500">— {review.author}</footer>}
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <SeerrRequestDialog
        item={item}
        open={open}
        onOpenChange={setOpen}
        onSubmit={async (body) => {
          await seerr("v1/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        }}
      />
    </AppShell>
  );
}
