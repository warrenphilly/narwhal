export const BROWSER_DEVICE_PROFILE = {
  MaxStreamingBitrate: 20_000_000,
  DirectPlayProfiles: [
    { Container: "mp4,m4v,mov,webm", Type: "Video", VideoCodec: "h264,vp9,av1", AudioCodec: "aac,mp3,opus,flac,vorbis" },
  ],
  TranscodingProfiles: [
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "http",
      Context: "Streaming",
      EstimateContentLength: false,
      CopyTimestamps: false,
    },
  ],
};

export const HLS_DEVICE_PROFILE = {
  MaxStreamingBitrate: 20_000_000,
  DirectPlayProfiles: [
    { Container: "mp4,m4v,mov,webm", Type: "Video", VideoCodec: "h264,vp9,av1", AudioCodec: "aac,mp3,opus,flac,vorbis" },
  ],
  TranscodingProfiles: [
    {
      Container: "ts",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "hls",
      Context: "Streaming",
      MaxAudioChannels: "2",
      MinSegments: 1,
      BreakOnNonKeyFrames: true,
    },
  ],
};

export const WEB_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "flac"]);
export const WEB_VIDEO = new Set(["h264", "avc", "avc1", "vp8", "vp9", "av1"]);
export const WEB_CONTAINERS = new Set(["mp4", "m4v", "mov", "webm"]);
