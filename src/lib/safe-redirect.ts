/**
 * Returns a same-origin path to redirect to after login, or `fallback`.
 * Accepts relative paths ("/convite/abc?x=1") and absolute URLs on `siteOrigin`
 * (Supabase email templates pass the full redirect URL). Rejects anything that could
 * lead off-site: protocol-relative "//evil.com", "/\evil.com", other origins, javascript:.
 */
export function safeNextPath(
  value: unknown,
  siteOrigin: string,
  fallback = "/",
): string {
  if (typeof value !== "string" || value === "") return fallback;

  let candidate = value.trim();

  if (!candidate.startsWith("/")) {
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      return fallback;
    }
    if (url.origin !== new URL(siteOrigin).origin) return fallback;
    candidate = `${url.pathname}${url.search}${url.hash}`;
  }

  // "//host" and "/\host" are treated as absolute URLs by browsers
  if (candidate.startsWith("//") || candidate.startsWith("/\\")) return fallback;
  // Control characters can be used to smuggle "//" past checks
  if (/[\u0000-\u001f]/.test(candidate)) return fallback;

  return candidate;
}
