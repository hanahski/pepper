// Unified media renderer for posts. Plays uploaded images, audio, video,
// or remote video links (YouTube, Vimeo, mp4 URLs, etc.) inline.
import ReactPlayer from "react-player";

type Props = {
  url: string;
  type?: string | null; // "image" | "video" | "audio" | mime fragment
  title?: string;
};

function detectType(url: string, type?: string | null): "image" | "video" | "audio" | "unknown" {
  if (type === "image" || type === "video" || type === "audio") return type;
  const u = url.toLowerCase();
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/.test(u)) return "image";
  if (/\.(mp3|wav|m4a|ogg|aac|flac)(\?|$)/.test(u)) return "audio";
  if (/\.(mp4|webm|mov|mkv|avi)(\?|$)/.test(u)) return "video";
  if (/(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|facebook\.com\/.+\/videos|soundcloud\.com)/.test(u)) return "video";
  return "unknown";
}

export function MediaPlayer({ url, type, title }: Props) {
  const kind = detectType(url, type);

  if (kind === "image") {
    return (
      <img
        src={url}
        alt={title ?? "media"}
        loading="lazy"
        className="w-full rounded-2xl border bg-muted object-contain max-h-[80vh]"
      />
    );
  }

  if (kind === "audio") {
    return (
      <audio controls src={url} className="w-full rounded-xl border bg-muted">
        Your browser does not support audio playback.
      </audio>
    );
  }

  if (kind === "video") {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black">
        <ReactPlayer
          src={url}
          controls
          width="100%"
          height="100%"
          style={{ position: "absolute", inset: 0 }}
        />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block text-sm text-primary underline break-all"
    >
      {url}
    </a>
  );
}
