import { addLog } from './logs.js';
import { adminState } from './state.js';
import { authHeaders, parseErrorResponse } from './http.js';
import { toast } from './utils.js';
import { loadMembers } from './members.js';
import { loadRepos } from './repos.js';
import { loadStatus } from './workspace.js';

export function pollRepoSyncJob(jobId, { name, button, defaultButtonText, doneLabel, doneToast, failLabel }) {
  const poll = () => {
    fetch(`/admin/repos/sync-jobs/${jobId}`, { headers: authHeaders() })
      .then((response) => {
        if (!response.ok) return parseErrorResponse(response);
        return response.json();
      })
      .then((job) => {
        const progressText =
          job.progress && job.status !== 'queued'
            ? ` ${job.progress.percent}% (${job.progress.processed}/${job.progress.total || 0})`
            : '';
        document.getElementById('sync-result').textContent = `${job.repoName} ${job.message}${progressText}`;

        if (job.status === 'queued' || job.status === 'running') {
          button.textContent = job.status === 'queued' ? '대기 중...' : `${Math.max(job.progress?.percent ?? 0, 1)}%`;
          setTimeout(poll, 2000);
          return;
        }

        if (job.status === 'completed') {
          const synced = job.result?.synced ?? 0;
          toast(doneToast(synced));
          document.getElementById('sync-result').textContent = doneLabel(synced);
          addLog(`${name} sync 완료 — ${synced}건`, 'ok');
          if (job.result?.failures?.length) {
            job.result.failures.forEach((f) => addLog(`  └ PR #${f.prNumber} 실패: ${f.error}`, 'err'));
          }
          Promise.all([loadStatus(), loadMembers(), loadRepos()]);
          return;
        }

        const detail = job.error ?? job.message ?? 'sync 실패';
        toast('단건 sync 실패');
        addLog(`${failLabel}: ${detail}`, 'err');
      })
      .catch((err) => {
        const detail = err?.message ?? String(err);
        addLog(`${failLabel}: ${detail}`, 'err');
      })
      .finally(() => {
        fetch(`/admin/repos/sync-jobs/${jobId}`, { headers: authHeaders() })
          .then((response) => (response.ok ? response.json() : null))
          .then((job) => {
            if (job?.status === 'queued' || job?.status === 'running') return;
            button.disabled = false;
            button.textContent = defaultButtonText;
          })
          .catch(() => {
            button.disabled = false;
            button.textContent = defaultButtonText;
          });
      });
  };

  poll();
}

export function syncRepo(id, button) {
  const repo = adminState.repoList.find((r) => r.id === id);
  const name = repo?.name ?? `#${id}`;
  button.disabled = true;
  button.textContent = '...';
  addLog(`${name} sync 중...`, 'run');
  fetch(`/admin/repos/${id}/sync`, { method: 'POST', headers: authHeaders() })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((job) => {
      addLog(`${name} sync 작업 등록 — ${job.id}`, 'info');
      pollRepoSyncJob(job.id, {
        name,
        button,
        defaultButtonText: 'Sync',
        doneLabel: (synced) => `${synced}건 수집 완료`,
        doneToast: (synced) => `${synced}건 수집됨`,
        failLabel: `${name} sync 실패`,
      });
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('단건 sync 실패');
      addLog(`${name} sync 실패: ${detail}`, 'err');
    });
}

export function resetSync(id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  const name = repo?.name ?? `#${id}`;
  if (
    !confirm(
      `${name}의 동기화 상태를 초기화하시겠습니까? (저장된 제출물은 유지되지만 다음 Sync 시 모든 PR을 다시 훑습니다)`,
    )
  )
    return;

  fetch(`/admin/repos/${id}/reset-sync`, { method: 'POST', headers: authHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error('failed');
      toast('동기화 초기화 완료');
      addLog(`${name} 동기화 상태 초기화 완료`, 'ok');
      return loadRepos();
    })
    .catch(() => alert('초기화에 실패했습니다.'));
}

export function triggerSync() {
  const button = document.getElementById('sync-btn');
  const progressWrap = document.getElementById('sync-progress-wrap');
  const progressBar = document.getElementById('sync-progress-bar');
  const progressLabel = document.getElementById('sync-progress-label');

  button.disabled = true;
  button.textContent = '동기화 중...';
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';
  progressLabel.textContent = '준비 중...';
  addLog('전체 Sync 시작', 'run');

  const cohortVal = document.getElementById('sync-cohort').value.trim();
  const cohortParam = cohortVal ? `&cohort=${encodeURIComponent(cohortVal)}` : '';
  const url = `/admin/sync/stream?token=${encodeURIComponent(adminState.token)}${cohortParam}`;
  const es = new EventSource(url);

  es.addEventListener('progress', (e) => {
    const { repo, done, total, synced } = JSON.parse(e.data);
    const pct = Math.round((done / total) * 100);
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = `(${done}/${total}) ${repo} — ${synced}건`;
    document.getElementById('sync-result').textContent = `진행 중: ${done}/${total} 레포`;
  });

  es.addEventListener('done', (e) => {
    const { reposSynced, totalSynced } = JSON.parse(e.data);
    progressBar.style.width = '100%';
    progressLabel.textContent = `완료: ${reposSynced}개 레포, ${totalSynced}건 수집됨`;
    document.getElementById('sync-result').textContent = `완료: ${reposSynced}개 레포, ${totalSynced}건 수집됨`;
    toast(`전체 sync 완료 (${totalSynced}건)`);
    addLog(`전체 Sync 완료 — ${reposSynced}개 레포, ${totalSynced}건 수집`, 'ok');
    es.close();
    button.disabled = false;
    button.textContent = '전체 Sync';
    Promise.all([loadStatus(), loadMembers(), loadRepos()]);
  });

  es.addEventListener('error', (e) => {
    const msg = e.data ? JSON.parse(e.data).message : 'sync 실패';
    progressLabel.textContent = `오류: ${msg}`;
    document.getElementById('sync-result').textContent = '전체 sync 실패';
    toast('전체 sync 실패');
    addLog(`전체 Sync 실패: ${msg}`, 'err');
    es.close();
    button.disabled = false;
    button.textContent = '전체 Sync';
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) return;
    progressLabel.textContent = '연결 오류';
    document.getElementById('sync-result').textContent = '전체 sync 실패';
    es.close();
    button.disabled = false;
    button.textContent = '전체 Sync';
  };
}

export function triggerTsAndLearningTest() {
  const repo = adminState.repoList.find((item) => item.name === 'ts-and-learning');
  if (!repo) {
    toast('ts-and-learning 레포가 등록되어 있지 않습니다.');
    return;
  }

  const button = document.getElementById('ts-learning-sync-btn');
  button.disabled = true;
  button.textContent = '테스트 중...';
  addLog('ts-and-learning 테스트 sync 중...', 'run');
  fetch(`/admin/repos/${repo.id}/sync`, { method: 'POST', headers: authHeaders() })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((job) => {
      addLog(`ts-and-learning 테스트 작업 등록 — ${job.id}`, 'info');
      pollRepoSyncJob(job.id, {
        name: 'ts-and-learning 테스트',
        button,
        defaultButtonText: 'ts-and-learning 테스트',
        doneLabel: (synced) => `ts-and-learning ${synced}건 수집`,
        doneToast: (synced) => `ts-and-learning 테스트 완료 (${synced}건)`,
        failLabel: 'ts-and-learning 테스트 실패',
      });
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('ts-and-learning 테스트 실패');
      addLog(`ts-and-learning 테스트 실패: ${detail}`, 'err');
      button.disabled = false;
      button.textContent = 'ts-and-learning 테스트';
    });
}
