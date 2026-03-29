import { addLog } from './logs.js';
import { authHeaders, parseErrorResponse } from './http.js';
import { toast } from './utils.js';
import { loadMembers } from './members.js';

export function triggerBlogSync() {
  const button = document.getElementById('blog-sync-btn');
  button.disabled = true;
  button.textContent = '동기화 중...';
  addLog('블로그 Sync 중...', 'run');
  fetch('/admin/blog/sync', { method: 'POST', headers: authHeaders() })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((data) => {
      toast(`블로그 ${data.synced}건 수집, ${data.deleted}건 삭제`);
      addLog(`블로그 Sync 완료 — 수집 ${data.synced}건, 삭제 ${data.deleted}건`, 'ok');
      if (data.failures?.length) {
        data.failures.forEach((failure) => {
          const target = failure.rssUrl ?? failure.blog;
          addLog(`  └ ${failure.githubId} ${failure.step}: ${target} — ${failure.error}`, 'err');
        });
      }
      return loadMembers();
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('블로그 sync 실패');
      addLog(`블로그 Sync 실패: ${detail}`, 'err');
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = '블로그 Sync';
    });
}

export function triggerBlogBackfill() {
  const button = document.getElementById('blog-backfill-btn');
  button.disabled = true;
  button.textContent = '조회 중...';
  const cohortVal = document.getElementById('sync-cohort').value.trim();
  const cohortParam = cohortVal ? `&cohort=${encodeURIComponent(cohortVal)}` : '';
  addLog(`블로그 링크 백필 중${cohortVal ? ` (${cohortVal}기)` : ''}...`, 'run');
  fetch(`/admin/blog/backfill?limit=30${cohortParam}`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      const failureText =
        data.failures.length > 0
          ? ` / 실패 예시: ${data.failures.map((item) => `${item.githubId}(${item.reason})`).join(', ')}`
          : '';
      document.getElementById('sync-result').textContent =
        `블로그 링크 확인 ${data.checked}명, 저장 ${data.updated}명, 비어 있음 ${data.missing}명, 실패 ${data.failed}명${failureText}`;
      toast(`블로그 링크 백필 완료 (${data.updated}명 저장)`);
      addLog(
        `블로그 백필 완료 — 확인 ${data.checked}명, 저장 ${data.updated}명, 없음 ${data.missing}명, 실패 ${data.failed}명`,
        'ok',
      );
      return loadMembers();
    })
    .catch(() => {
      toast('블로그 링크 백필 실패');
      addLog('블로그 백필 실패', 'err');
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = '블로그 링크 백필';
    });
}
