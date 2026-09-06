import type { JellyfinItem } from "@/lib/jellyfin-types";

const demo: JellyfinItem[] = [
  {
    Id: "demo-harbor",
    Name: "Harbor Lights",
    Overview:
      "A night ferry captain chases a missing cargo crate across a rain-soaked city port. Sample title for preview — connect your Jellyfin server to see your movies.",
    ProductionYear: 2024,
    OfficialRating: "PG-13",
    CommunityRating: 8.4,
    RunTimeTicks: 7_800_000_0000,
    Genres: ["Thriller", "Drama"],
    CanDownload: false,
  },
  {
    Id: "demo-circuit",
    Name: "Night Circuit",
    Overview:
      "Two radio engineers try to keep a mountain transmitter alive during a winter blackout.",
    ProductionYear: 2022,
    OfficialRating: "PG",
    CommunityRating: 7.9,
    RunTimeTicks: 6_300_000_0000,
    Genres: ["Adventure"],
    CanDownload: false,
  },
  {
    Id: "demo-atlas",
    Name: "Paper Atlas",
    Overview: "A cartographer inherits a map that redraws itself every sunrise.",
    ProductionYear: 2021,
    OfficialRating: "PG",
    CommunityRating: 8.1,
    RunTimeTicks: 6_900_000_0000,
    Genres: ["Fantasy"],
    CanDownload: false,
  },
  {
    Id: "demo-orbit",
    Name: "Quiet Orbit",
    Overview: "A station cook on the lunar rim trades recipes for news from Earth.",
    ProductionYear: 2023,
    OfficialRating: "TV-14",
    CommunityRating: 8.6,
    RunTimeTicks: 7_200_000_0000,
    Genres: ["Science Fiction"],
    CanDownload: false,
  },
  {
    Id: "demo-glass",
    Name: "Glass Season",
    Overview: "A glassblower and a storm chaser share a workshop on the coast.",
    ProductionYear: 2020,
    OfficialRating: "PG",
    CommunityRating: 7.4,
    RunTimeTicks: 5_800_000_0000,
    Genres: ["Romance", "Drama"],
    CanDownload: false,
  },
  {
    Id: "demo-copper",
    Name: "Copper Line",
    Overview: "A rail inspector finds a hidden town that only appears at mile 412.",
    ProductionYear: 2019,
    OfficialRating: "PG-13",
    CommunityRating: 7.7,
    RunTimeTicks: 6_600_000_0000,
    Genres: ["Mystery"],
    CanDownload: false,
  },
  {
    Id: "demo-salt",
    Name: "Salt Archive",
    Overview: "An archivist catalogs songs that only play when it snows.",
    ProductionYear: 2025,
    OfficialRating: "PG",
    CommunityRating: 8.2,
    RunTimeTicks: 6_000_000_0000,
    Genres: ["Music", "Drama"],
    CanDownload: false,
  },
  {
    Id: "demo-ember",
    Name: "Ember Index",
    Overview: "A librarian of extinct volcanoes is asked to reopen one file.",
    ProductionYear: 2018,
    OfficialRating: "PG-13",
    CommunityRating: 7.1,
    RunTimeTicks: 8_100_000_0000,
    Genres: ["Action"],
    CanDownload: false,
  },
];

export const DEMO_MOVIES = demo.map((item, index) => ({
  ...item,
  Type: "Movie",
  RunTimeTicks: 6_000_000_0000 + index * 300_000_0000,
}));

export const DEMO_SHOWS: JellyfinItem[] = [
  {
    Id: "demo-show-harbor",
    Name: "Dockside",
    Type: "Series",
    Overview: "A weekly dispatch from a working port after the last ferry leaves.",
    ProductionYear: 2024,
    OfficialRating: "TV-14",
    CommunityRating: 8.3,
    Genres: ["Drama"],
    CanDownload: false,
  },
  {
    Id: "demo-show-orbit",
    Name: "Relay",
    Type: "Series",
    Overview: "Night operators keep a mountain radio alive through winter.",
    ProductionYear: 2023,
    OfficialRating: "TV-PG",
    CommunityRating: 8.1,
    Genres: ["Science Fiction"],
    CanDownload: false,
  },
  {
    Id: "demo-show-atlas",
    Name: "Folded Maps",
    Type: "Series",
    Overview: "Cartographers argue over a coast that will not stay still.",
    ProductionYear: 2022,
    OfficialRating: "TV-PG",
    CommunityRating: 7.8,
    Genres: ["Mystery"],
    CanDownload: false,
  },
  {
    Id: "demo-show-salt",
    Name: "Low Tide",
    Type: "Series",
    Overview: "A kitchen on the pier cooks only what the morning boats bring in.",
    ProductionYear: 2025,
    OfficialRating: "TV-G",
    CommunityRating: 7.6,
    Genres: ["Comedy"],
    CanDownload: false,
  },
];

export function isDemoId(id: string) {
  return id.startsWith("demo-");
}

export function demoPosterGradient(id: string) {
  const palettes = [
    ["#93c5fd", "#fda4af"],
    ["#67e8f9", "#818cf8"],
    ["#f9a8d4", "#c4b5fd"],
    ["#fdba74", "#fca5a5"],
    ["#86efac", "#7dd3fc"],
    ["#fde68a", "#fdba74"],
    ["#a5b4fc", "#fbcfe8"],
    ["#99f6e4", "#93c5fd"],
  ];
  const index = Math.abs(
    id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  );
  return palettes[index % palettes.length];
}
