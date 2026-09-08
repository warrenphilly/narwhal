export const BROWSER_DEVICE_PROFILE = {
  MaxStreamingBitrate: 12_000_000,
  DirectPlayProfiles: [
    { Container: "mp4,m4v,mov", Type: "Video", VideoCodec: "h264", AudioCodec: "aac,mp3" },
  ],
  TranscodingProfiles: [
    {
      Container: "mp4",
      Type: "Video",
      VideoCodec: "h264",
      AudioCodec: "aac",
      Protocol: "http",
      EstimateContentLength: true,
    },
  ],
};
