/** Normalize request path for per-route rate limits (template keys). */
export function rateLimitKeyForPath(path: string): string {
  const bare = path.split("?")[0] ?? path;
  if (/^\/watch\/company\/[^/]+\/runs\/?$/.test(bare)) {
    return "/watch/company/:id/runs";
  }
  if (/^\/watch\/company\/[^/]+\/?$/.test(bare) && bare !== "/watch/company") {
    return "/watch/company/:id";
  }
  return bare;
}
