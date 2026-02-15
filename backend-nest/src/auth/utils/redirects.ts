export function getAllowedRedirects(): string[] {
  const allowed = [
    process.env.MOBILE_REDIRECT_URI,
    process.env.WEB_REDIRECT_URI,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return Array.from(new Set(allowed));
}

export function isAllowedRedirect(candidate?: string | null): string | null {
  if (!candidate) return null;
  const allowed = getAllowedRedirects();
  if (allowed.length === 0) return null;
  return allowed.find((allowedUrl) => candidate.startsWith(allowedUrl))
    ? candidate
    : null;
}

export function encodeRedirectState(redirect: string): string {
  const payload = JSON.stringify({ redirect });
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeRedirectState(state?: string | null): string | null {
  if (!state) return null;
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as { redirect?: string };
    return typeof parsed.redirect === 'string' ? parsed.redirect : null;
  } catch {
    return null;
  }
}
