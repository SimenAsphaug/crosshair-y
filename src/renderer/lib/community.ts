import type { Design } from "../../shared/types";
import { normalizeDesign, toPortable } from "../../shared/design";

export interface CommunityEntry {
  slug: string;
  author: string;
  tags: string[];
  game: string | null;
  added: string | null; // ISO date
  design: Design;
}

/**
 * Index format (built by scripts/build-community-index.mjs):
 * { "version": 1, "designs": [ { "slug", "author", "tags", "game", "added", "design": {...} } ] }
 */
export async function fetchCommunity(url: string): Promise<CommunityEntry[]> {
  if (!/^https:\/\//.test(url)) throw new Error("The community URL must start with https://");
  const res = await fetch(url, { cache: "no-cache" });
  if (res.status === 404) throw new Error("The community gallery hasn't been published yet (index.json not found).");
  if (!res.ok) throw new Error(`Couldn't load the community gallery (HTTP ${res.status}).`);
  const data = await res.json();
  if (!data || !Array.isArray(data.designs)) throw new Error("The community index has an unexpected format.");
  return data.designs.slice(0, 5000).map((e: any, i: number) => {
    const slug = typeof e.slug === "string" ? e.slug.slice(0, 80) : `entry-${i}`;
    return {
      slug,
      author: typeof e.author === "string" ? e.author.slice(0, 40) : "unknown",
      tags: Array.isArray(e.tags) ? e.tags.filter((t: unknown) => typeof t === "string").slice(0, 8).map((t: string) => t.slice(0, 24).toLowerCase()) : [],
      game: typeof e.game === "string" ? e.game.slice(0, 40) : null,
      added: typeof e.added === "string" ? e.added.slice(0, 32) : null,
      design: { ...normalizeDesign(e.design, false), id: `community:${slug}` },
    };
  });
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "crosshair"
  );
}

/** JSON file contents for a community submission. */
export function submissionJson(d: Design, author: string, tags: string[], game: string | null) {
  return JSON.stringify(
    {
      author: author.trim() || "anonymous",
      tags,
      game,
      design: toPortable(d),
    },
    null,
    2,
  );
}

/**
 * GitHub's "create new file" page accepts a prefilled filename and value. For
 * people without write access GitHub offers to fork and open a pull request.
 */
export function submissionUrl(repo: string, d: Design, json: string) {
  const name = `${slugify(d.name)}-${Date.now().toString(36)}.json`;
  const base = `https://github.com/${repo}/new/main/community/designs`;
  const full = `${base}?filename=${encodeURIComponent(name)}&value=${encodeURIComponent(json)}`;
  // Very long URLs (e.g. designs with images) fail; fall back to an empty file page.
  return full.length < 7500 ? { url: full, prefilled: true } : { url: `${base}?filename=${encodeURIComponent(name)}`, prefilled: false };
}
