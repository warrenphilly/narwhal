"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Carousel } from "@/components/carousel";
import { imageUrl } from "@/lib/client-api";
import { formatRuntime } from "@/lib/jellyfin-types";
import type { JellyfinItem, MediaStream } from "@/lib/jellyfin-types";
import { demoPosterGradient, isDemoId } from "@/lib/demo-library";
import { Button } from "@/components/ui/button";

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

export function TitlePoster({ item }: { item: JellyfinItem }) {
  const demo = isDemoId(item.Id);
  const [from, to] = demoPosterGradient(item.Id);
  return (
    <div className="hidden w-[168px] shrink-0 lg:block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-zinc-200 shadow-[0_16px_36px_rgba(0,0,0,0.12)] dark:bg-zinc-800">
        {demo ? (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl(item.Id, { maxHeight: 540 })}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
    </div>
  );
}

export function TitleFacts({
  item,
  streams,
  trailers,
}: {
  item: JellyfinItem;
  streams?: MediaStream[];
  trailers?: JellyfinItem[];
}) {
  const router = useRouter();
  const demo = isDemoId(item.Id);
  const audio = demo ? ["English"] : streamLabels(streams, "Audio");
  const subs = demo ? ["English", "Spanish"] : streamLabels(streams, "Subtitle");
  const remote = item.RemoteTrailers?.filter((row) => row.Url) ?? [];
  const local = trailers ?? [];
  const cast = (item.People ?? []).filter((person) => !person.Type || person.Type === "Actor");
  const directors = (item.People ?? []).filter((person) => person.Type === "Director");
  const runtime = formatRuntime(item.RunTimeTicks);

  return (
    <div className="mt-8 space-y-6">
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        {runtime && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Runtime</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">{runtime}</dd>
          </div>
        )}
        {item.OfficialRating && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Rating</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">{item.OfficialRating}</dd>
          </div>
        )}
        {(item.CommunityRating || item.CriticRating) && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Scores</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">
              {[
                item.CommunityRating ? `${item.CommunityRating.toFixed(1)} community` : "",
                item.CriticRating ? `${item.CriticRating} critic` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        )}
        {audio.length > 0 && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Languages</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">{audio.join(", ")}</dd>
          </div>
        )}
        {subs.length > 0 && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Subtitles</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">{subs.join(", ")}</dd>
          </div>
        )}
        {directors.length > 0 && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Director</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">
              {directors.map((person) => person.Name).filter(Boolean).join(", ")}
            </dd>
          </div>
        )}
        {item.Studios?.[0]?.Name && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Studio</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">
              {item.Studios.map((studio) => studio.Name).filter(Boolean).join(", ")}
            </dd>
          </div>
        )}
        {item.Status && (
          <div>
            <dt className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Status</dt>
            <dd className="mt-1 text-zinc-800 dark:text-zinc-100">{item.Status}</dd>
          </div>
        )}
      </dl>

      {(local.length > 0 || remote.length > 0) && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Trailers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {local.map((trailer) => (
              <Button
                key={trailer.Id}
                variant="secondary"
                className="rounded-full"
                onClick={() => router.push(`/watch/${trailer.Id}`)}
              >
                <Play data-icon="inline-start" className="fill-current" />
                {trailer.Name || "Trailer"}
              </Button>
            ))}
            {remote.map((trailer) => (
              <a
                key={trailer.Url}
                href={trailer.Url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center rounded-full bg-zinc-900/6 px-3 text-sm text-zinc-800 hover:bg-zinc-900/10 dark:bg-white/8 dark:text-zinc-100"
              >
                {trailer.Name || "Watch trailer"}
              </a>
            ))}
          </div>
        </div>
      )}

      {demo && local.length === 0 && remote.length === 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Trailers</p>
          <p className="mt-2 text-sm text-zinc-500">Trailers appear here after you sign in to Jellyfin.</p>
        </div>
      )}

      {cast.length > 0 && (
        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Cast</p>
          <Carousel className="mt-3 -mx-2" itemGap="gap-3">
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
      )}
    </div>
  );
}
