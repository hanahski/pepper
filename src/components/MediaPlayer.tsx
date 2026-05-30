// Unified media renderer for posts. Plays uploaded images, audio, video,
// or remote video links (YouTube, Vimeo, mp4 URLs, etc.) inline.
// - Only one media plays at a time across the whole app (global coordinator).
// - Video preview is large & responsive regardless of source resolution.
// - Native video/audio are downloadable; video has a fullscreen button.
import { useEffect, useRef } from "react";
import ReactPlayer from "react-player";
import { Download, Maximize2 } from "lucide-react";

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

// --- Global single-playback coordinator -----------------------------------
// When any media element starts playing, pause every other one.
const mediaRegistry = new Set<HTMLMediaElement>();
function pauseOthers(current: HTMLMediaElement) {
  mediaRegistry.forEach((el) => {
    if (el !== current && !el.paused) el.pause();
  });
}
function useSinglePlayback(ref: React.RefObject<HTMLMediaElement>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    mediaRegistry.add(el);
    const onPlay = () => pauseOthers(el);
    el.addEventListener("play", onPlay);
    return () => {
      el.removeEventListener("play", onPlay);
      mediaRegistry.delete(el);
    };
  }, [ref]);
}

function isNativeFile(url: string) {
  return /\.(mp4|webm|mov|mkv|avi|mp3|wav|m4a|ogg|aac|flac)(\?|$)/i.test(url);
}

export function MediaPlayer({ url, type, title }: Props) {
  const kind = detectType(url, type);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  useSinglePlayback(videoRef as React.RefObject<HTMLMediaElement>);
  useSinglePlayback(audioRef as React.RefObject<HTMLMediaElement>);

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
      <div className="space-y-2">
        <audio ref={audioRef} controls src={url} className="w-full rounded-xl border bg-muted">
          Your browser does not support audio playback.
        </audio>
        <a
          href={url}
          download
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <Download className="w-3.5 h-3.5" /> Download audio
        </a>
      </div>
    );
  }

  if (kind === "video") {
    // Native files: use a real <video> so we control playback, fullscreen & download.
    if (isNativeFile(url)) {
      const goFullscreen = () => {
        const el = videoRef.current;
        if (!el) return;
        if (el.requestFullscreen) el.requestFullscreen();
        // @ts-expect-error iOS Safari
        else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
      };
      return (
        <div className="space-y-2">
          <div className="relative w-full overflow-hidden rounded-2xl border bg-black">
            <video
              ref={videoRef}
              src={url}
              controls
              playsInline
              preload="metadata"
              className="w-full max-h-[85vh] object-contain bg-black"
            />
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={goFullscreen}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
            </button>
            <a
              href={url}
              download
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Download video
            </a>
          </div>
        </div>
      );
    }
    // Remote streams (YouTube/Vimeo/etc.) — responsive 16:9 frame.
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
