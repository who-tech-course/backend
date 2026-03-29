import { adminState } from './state.js';
import { authHeaders } from './http.js';
import { toast } from './utils.js';
import { addLog } from './logs.js';

export function loadStatus() {
  return fetch('/admin/status', { headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('member-count').textContent = data.memberCount;
      document.getElementById('repo-count').textContent = data.repoCount;
      document.getElementById('last-sync').textContent = data.lastSyncAt
        ? new Date(data.lastSyncAt).toLocaleString('ko-KR')
        : '없음';
    });
}

export function loadWorkspace() {
  return fetch('/admin/workspace', { headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('nickname-regex').value = data.nicknameRegex;
      document.getElementById('cohort-rules').value = JSON.stringify(data.cohortRules, null, 2);
      updateBlogSyncToggle(data.blogSyncEnabled);
    });
}

export function updateBlogSyncToggle(enabled) {
  const btn = document.getElementById('blog-sync-toggle');
  if (!btn) return;
  btn.classList.toggle('active', enabled);

  clearInterval(adminState.blogSyncCountdownTimer);
  adminState.blogSyncCountdownTimer = null;

  if (enabled) {
    const updateCountdown = () => {
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      const diffMs = nextHour - now;
      const diffMin = Math.floor(diffMs / 60000);
      const diffSec = Math.floor((diffMs % 60000) / 1000);
      btn.textContent = `블로그 자동수집 ON · ${diffMin}분 ${diffSec}초 후`;
    };
    updateCountdown();
    adminState.blogSyncCountdownTimer = setInterval(updateCountdown, 1000);
  } else {
    btn.textContent = '블로그 자동수집 OFF';
  }
}

export function toggleBlogSync() {
  fetch('/admin/workspace', { headers: authHeaders() })
    .then((res) => res.json())
    .then((data) => {
      const next = !data.blogSyncEnabled;
      return fetch('/admin/workspace', {
        method: 'PUT',
        headers: authHeaders('application/json'),
        body: JSON.stringify({ blogSyncEnabled: next }),
      }).then(() => {
        updateBlogSyncToggle(next);
        toast(`블로그 자동수집 ${next ? 'ON' : 'OFF'}`);
      });
    })
    .catch(() => toast('설정 변경 실패'));
}

export function saveWorkspace() {
  let cohortRules;

  try {
    cohortRules = JSON.parse(document.getElementById('cohort-rules').value);
  } catch {
    alert('기수 규칙 JSON 형식이 올바르지 않습니다.');
    return;
  }

  fetch('/admin/workspace', {
    method: 'PUT',
    headers: authHeaders('application/json'),
    body: JSON.stringify({
      nicknameRegex: document.getElementById('nickname-regex').value,
      cohortRules,
    }),
  })
    .then(() => {
      toast('Workspace 저장 완료');
      addLog('Workspace 설정 저장 완료', 'ok');
    })
    .catch(() => {
      toast('Workspace 저장 실패');
      addLog('Workspace 저장 실패', 'err');
    });
}
