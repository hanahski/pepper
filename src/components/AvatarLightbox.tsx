import { useEffect } from "react";
import { X } from "lucide-react";
import { avatarDataUri } from "@/lib/avatars";

export function AvatarLightbox({ avatarKey, open, onClose }: { avatarKey: string; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={avatarDataUri(avatarKey)}
        alt="Profile photo"
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] rounded-2xl shadow-glow object-contain animate-scale-in"
      />
    </div>
  );
}
