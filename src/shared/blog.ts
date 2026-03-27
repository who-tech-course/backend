export function normalizeBlogUrl(blogUrl: string | null | undefined): string | null {
  if (!blogUrl) {
    return null;
  }

  const trimmed = blogUrl.trim();
  if (!trimmed) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
