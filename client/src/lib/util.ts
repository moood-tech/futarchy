/** Session play-money player handle. NOT an identity — a leaderboard nickname. */

const HANDLES = [
  "otter",
  "heron",
  "marten",
  "vireo",
  "sable",
  "quokka",
  "lynx",
  "tanager",
];

export function getPlayer(): { id: string; handle: string } {
  const existing = localStorage.getItem("poc_player");
  if (existing) return JSON.parse(existing);
  // Derive a stable-ish handle from the clock — this is a play-money nickname,
  // deliberately not tied to any real identity.
  const n = Date.now();
  const handle = `${HANDLES[n % HANDLES.length]}-${(n % 900) + 100}`;
  const player = { id: `plr_${n.toString(36)}`, handle };
  localStorage.setItem("poc_player", JSON.stringify(player));
  return player;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const pct1 = (x: number) => `${(x * 100).toFixed(1)}%`;

export const money = (x: number) =>
  `§${x.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export const signed = (x: number) =>
  `${x > 0 ? "+" : ""}${x.toFixed(1)}`;

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
