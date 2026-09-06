"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Carousel } from "@/components/carousel";
import { imageUrl } from "@/lib/client-api";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem, MediaStream } from "@/lib/jellyfin-types";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";

const LANG: Record<string, string> = {
  en: "English",
  eng: "English",
  es: "Spanish",
  spa: "Spanish",
  fr: "French",
  fre: "French",
  fra: "French",
  de: "German",
  ger: "German",
  deu: "German",
  ja: "Japanese",
  jpn: "Japanese",
  ko: "Korean",
  kor: "Korean",
  zh: "Chinese",
  chi: "Chinese",
  zho: "Chinese",
  it: "Italian",
  ita: "Italian",
  pt: "Portuguese",
  por: "Portuguese",
  hi: "Hindi",
  hin: "Hindi",
};

function prettyLang(code?: string) {
  if (!code) return "";
  const key = code.toLowerCase();
  return LANG[key] || code;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function streamLabels(streams: MediaStream[] | undefined, type: string) {
  return unique(
    (streams ?? [])
      .filter((stream) => stream.Type === type)
      .map((stream) => prettyLang(stream.Language) || stream.DisplayTitle || type)
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

export function TitlePoster({ item }: { item: JellyfinItem }) {
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  return (
    <div className="hidden w-[210px] shrink-0 xl:w-[240px] lg:block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-200 shadow-[0_16px_36px_rgba(0,0,0,0.12)] dark:bg-zinc-800">
        {demo ? (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(item.Id, { maxHeight: 720 })}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
    </div>
  );
}

export function TitleMeta({
  item,
  streams,
  extras = [],
  trailers,
}: {
  item: JellyfinItem;
  streams?: MediaStream[];
  extras?: string[];
  trailers?: JellyfinItem[];
}) {
  const router = useRouter();
  const demo = isDemoId(item.Id);
  const audio = demo ? ["English"] : streamLabels(streams, "Audio");
  const subs = demo ? ["English", "Spanish"] : streamLabels(streams, "Subtitle");
  const remote = item.RemoteTrailers?.filter((row) => row.Url) ?? [];
  const local = trailers ?? [];
  const directors = (item.People ?? [])
    .filter((person) => person.Type === "Director")
    .map((person) => person.Name)
    .filter(Boolean);
  const studios = (item.Studios ?? []).map((studio) => studio.Name).filter(Boolean);
  const chips = [
    item.ProductionYear ? String(item.ProductionYear) : "",
    formatRuntime(item.RunTimeTicks),
    item.CommunityRating ? `${item.CommunityRating.toFixed(1)} ★` : "",
    item.CriticRating ? `${item.CriticRating} critic` : "",
    audio.length ? audio.join(", ") : "",
    subs.length ? `Subs ${subs.join(", ")}` : "",
    directors.length ? directors.join(", ") : "",
    studios.length ? studios.join(", ") : "",
    item.Status ?? "",
    ...(item.Genres ?? []),
    ...extras,
  ].filter(Boolean);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
      {item.OfficialRating && (
        <span className="rounded border border-zinc-300 px-1.5 py-0.5 text-xs dark:border-zinc-600">
          {item.OfficialRating}
        </span>
      )}
      {chips.map((chip, index) => (
        <Chip key={`${chip}-${index}`}>{chip}</Chip>
      ))}
      {local.map((trailer) => (
        <button
          key={trailer.Id}
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
          onClick={() => router.push(`/watch/${trailer.Id}`)}
        >
          <Play className="size-3 fill-current" />
          {trailer.Name || "Trailer"}
        </button>
      ))}
      {remote.map((trailer) => (
        <a
          key={trailer.Url}
          href={trailer.Url}
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          {trailer.Name || "Trailer"}
        </a>
      ))}
    </div>
  );
}

export function TitleCast({ item }: { item: JellyfinItem }) {
  const cast = (item.People ?? []).filter((person) => !person.Type || person.Type === "Actor");
  if (!cast.length) return null;
  return (
    <div className="mt-6">
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Cast</p>
      <Carousel className="mt-2 -mx-2" itemGap="gap-3">
        {cast.map((person, index) => {
          const personId = person.Id;
          const [from, to] = demoPosterGradient(personId || person.Name || String(index));
          return (
            <div key={`${personId}-${person.Name}`} className="w-[120px] shrink-0 snap-start">
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
                {personId && !isDemoId(personId) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl(personId, { maxHeight: 360, tag: person.PrimaryImageTag })}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
                  />
                )}
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {person.Name}
              </p>
              {person.Role && <p className="line-clamp-1 text-xs text-zinc-500">{person.Role}</p>}
            </div>
          );
        })}
      </Carousel>
    </div>
  );
}
