export function roleLabel(role) {
  return role === 'coach' ? '코치' : role === 'reviewer' ? '리뷰어' : '크루';
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 2600);
}

export function parseJsonOrNull(value) {
  if (!value) return null;
  return JSON.parse(value);
}

export function formatRepoRegex(repo) {
  const cohortRules = repo.cohortRegexRules ?? [];
  if (cohortRules.length > 0) {
    return cohortRules.map((rule) => `${rule.cohort}기: ${rule.nicknameRegex}`).join('\n');
  }

  return repo.nicknameRegex ?? 'workspace 기본 정규식';
}
