import { avatarDataUri } from "@/lib/avatars";
import { cn } from "@/lib/utils";

export function AvatarDisplay({
  avatarKey,
  size = 40,
  online,
  className,
}: {
  avatarKey: string;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <img
        src={avatarDataUri(avatarKey)}
        alt=""
        width={size}
        height={size}
        className="rounded-full border-2 border-card shadow-card object-cover"
      />
      {online && (
        <span
          className="online-dot absolute bottom-0 right-0 block rounded-full bg-success border-2 border-card"
          style={{ width: Math.max(size * 0.28, 10), height: Math.max(size * 0.28, 10) }}
          aria-label="Online"
        />
      )}
    </div>
  );
}
