export type JellyfinImageTags = Record<string, string>;

export type JellyfinUser = {
  Id: string;
  Name: string;
};

export type JellyfinAuthResult = {
  AccessToken: string;
  User: JellyfinUser;
};

export type MediaStream = {
  Type?: string;
  Index?: number;
  Language?: string;
  DisplayTitle?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  Codec?: string;
};

export type MediaSource = {
  Id?: string;
  Size?: number;
  Container?: string;
  Name?: string;
  Path?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  DefaultSubtitleStreamIndex?: number;
  MediaStreams?: MediaStream[];
};

export type PlaybackInfo = {
  PlaySessionId?: string;
  MediaSources?: MediaSource[];
};

export type JellyfinPerson = {
  Id?: string;
  Name?: string;
  Role?: string;
  Type?: string;
  PrimaryImageTag?: string;
};

export type RemoteTrailer = {
  Url?: string;
  Name?: string;
};

export type JellyfinItem = {
  Id: string;
  Name: string;
  Type?: string;
  CollectionType?: string;
  Overview?: string;
  ProductionYear?: number;
  DateCreated?: string;
  PremiereDate?: string;
  OfficialRating?: string;
  CommunityRating?: number;
  CriticRating?: number;
  RunTimeTicks?: number;
  Genres?: string[];
  SeriesName?: string;
  SeriesId?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  Status?: string;
  Taglines?: string[];
  Studios?: { Name?: string }[];
  ProductionLocations?: string[];
  People?: JellyfinPerson[];
  RemoteTrailers?: RemoteTrailer[];
  ChildCount?: number;
  CanDownload?: boolean;
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
    Played?: boolean;
  };
  ImageTags?: JellyfinImageTags;
  BackdropImageTags?: string[];
  PrimaryImageAspectRatio?: number;
  MediaSources?: MediaSource[];
};

export type JellyfinItemsResult = {
  Items?: JellyfinItem[];
  TotalRecordCount?: number;
};

export function ticksToMinutes(ticks?: number) {
  if (!ticks) return 0;
  return Math.round(ticks / 10_000_000 / 60);
}

export function formatRuntime(ticks?: number) {
  const minutes = ticksToMinutes(ticks);
  if (!minutes) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return `${hours}h ${rest}m`;
}

export function formatBytes(bytes?: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i += 1;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function fileNameForItem(item: JellyfinItem) {
  const source = item.MediaSources?.[0];
  const container = source?.Container?.replace(/^\./, "") || "mp4";
  const year = item.ProductionYear ? ` (${item.ProductionYear})` : "";
  const safe = (item.Name || "movie").replace(/[<>:"/\\|?*]/g, "").trim();
  return `${safe}${year}.${container}`;
}
