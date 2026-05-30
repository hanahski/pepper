// 5 stylized avatars (3 boys, 2 girls) using inline SVG data URIs — keeps bundle tiny.
export type AvatarKey = "boy-1" | "boy-2" | "boy-3" | "girl-1" | "girl-2";

const face = (skin: string, hair: string, accent: string, extra = "") => `
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>
  <defs><linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
    <stop offset='0' stop-color='${accent}' stop-opacity='0.35'/>
    <stop offset='1' stop-color='${accent}' stop-opacity='0.9'/>
  </linearGradient></defs>
  <rect width='120' height='120' rx='60' fill='url(#bg)'/>
  <circle cx='60' cy='52' r='22' fill='${skin}'/>
  <path d='M30 100 q30 -25 60 0 v20 h-60z' fill='${hair}'/>
  ${extra}
  <circle cx='52' cy='52' r='2.5' fill='#1a1a2e'/>
  <circle cx='68' cy='52' r='2.5' fill='#1a1a2e'/>
  <path d='M52 62 q8 6 16 0' stroke='#1a1a2e' stroke-width='2' fill='none' stroke-linecap='round'/>
</svg>`;

export const AVATARS: Record<AvatarKey, { label: string; svg: string; gender: "boy" | "girl" }> = {
  "boy-1": {
    label: "Sage", gender: "boy",
    svg: face("#f3c9a4", "#2d1b1b", "#4f46e5",
      "<path d='M38 40 q22 -18 44 0 v8 h-44z' fill='#2d1b1b'/>"),
  },
  "boy-2": {
    label: "Rex", gender: "boy",
    svg: face("#c98860", "#0d0d0d", "#0ea5e9",
      "<path d='M40 38 q20 -12 40 0 v6 h-40z' fill='#0d0d0d'/>"),
  },
  "boy-3": {
    label: "Kai", gender: "boy",
    svg: face("#e8b48a", "#6b3a1b", "#10b981",
      "<path d='M38 34 q22 -8 44 4 l-4 12 q-18 -10 -36 0z' fill='#6b3a1b'/>"),
  },
  "girl-1": {
    label: "Zoe", gender: "girl",
    svg: face("#f4caa7", "#1a0f0a", "#ec4899",
      "<path d='M30 60 q0 -40 30 -40 t30 40 v-2 q-30 8 -60 2z' fill='#1a0f0a'/><path d='M28 60 q-2 30 6 50 h12 q-6 -25 -2 -45z' fill='#1a0f0a'/><path d='M92 60 q2 30 -6 50 h-12 q6 -25 2 -45z' fill='#1a0f0a'/>"),
  },
  "girl-2": {
    label: "Mira", gender: "girl",
    svg: face("#d49a72", "#4a1f0a", "#f59e0b",
      "<path d='M32 56 q-4 -36 28 -38 t28 38 q-2 -8 -28 -4 t-28 4z' fill='#4a1f0a'/>"),
  },
};

export const AVATAR_KEYS = Object.keys(AVATARS) as AvatarKey[];

export function avatarDataUri(key: string): string {
  if (key && /^https?:\/\//i.test(key)) return key;
  const a = AVATARS[(key as AvatarKey)] ?? AVATARS["boy-1"];
  return `data:image/svg+xml;utf8,${encodeURIComponent(a.svg.trim())}`;
}
