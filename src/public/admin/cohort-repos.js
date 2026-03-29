import { addLog } from './logs.js';
import { adminState } from './state.js';
import { authHeaders } from './http.js';
import { escapeHtml, toast } from './utils.js';
import { updateRepoLevel } from './repos.js';
import { loadMembers } from './members.js';
import { loadStatus } from './workspace.js';

export function loadCohortRepos() {
  const cohort = Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) {
    document.getElementById('cohort-repo-table-body').innerHTML = '';
    return;
  }
  adminState.cohortRepoSelectedCohort = cohort;
  fetch(`/admin/cohort-repos?cohort=${cohort}`, { headers: authHeaders() })
    .then((r) => r.json())
    .then((data) => {
      adminState.cohortRepoList = data;
      renderCohortRepos();
    })
    .catch(() => toast('기수 레포 목록 불러오기 실패'));
}

export function renderCohortRepos() {
  const tbody = document.getElementById('cohort-repo-table-body');
  const trackFilter = document.getElementById('cohort-repo-track-filter')?.value ?? '';
  const filtered = trackFilter ? adminState.cohortRepoList.filter((e) => e.missionRepo.track === trackFilter) : adminState.cohortRepoList;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:16px">추가된 레포 없음</td></tr>`;
    return;
  }

  const groups = new Map();
  for (const entry of filtered) {
    const level = entry.missionRepo.level;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(entry);
  }
  const sortedLevels = [...groups.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  tbody.innerHTML = sortedLevels
    .flatMap((level) => {
      const entries = groups.get(level).sort((a, b) => a.order - b.order);
      const header = `<tr><td colspan="5" style="background:#f8fafc;font-size:12px;font-weight:700;color:#475569;padding:8px 14px">${level != null ? `${level}단계` : '단계 미지정'} (${entries.length}개)</td></tr>`;
      const rows = entries.map(
        (entry) => `
      <tr>
        <td class="muted small">${entry.order}</td>
        <td><strong>${escapeHtml(entry.missionRepo.name)}</strong></td>
        <td class="muted small">${entry.missionRepo.track ?? '공통'}</td>
        <td>
          <select class="inline-sel" onchange="changeCohortRepoLevel(${entry.missionRepo.id}, this.value)">
            <option value="" ${level == null ? 'selected' : ''}>-</option>
            <option value="1" ${level === 1 ? 'selected' : ''}>1단계</option>
            <option value="2" ${level === 2 ? 'selected' : ''}>2단계</option>
            <option value="3" ${level === 3 ? 'selected' : ''}>3단계</option>
            <option value="4" ${level === 4 ? 'selected' : ''}>4단계</option>
            <option value="5" ${level === 5 ? 'selected' : ''}>5단계</option>
            <option value="6" ${level === 6 ? 'selected' : ''}>6단계</option>
          </select>
        </td>
        <td>
          <div class="actions">
            <input type="number" class="order-input" value="${entry.order}" onchange="setCohortRepoOrder(${entry.id}, this.value)" title="순서" style="width:52px" />
            <button class="btn-sm btn-danger" onclick="deleteCohortRepo(${entry.id})">삭제</button>
          </div>
        </td>
      </tr>
    `,
      );
      return [header, ...rows];
    })
    .join('');
}

export function addCohortRepo() {
  const cohort = adminState.cohortRepoSelectedCohort;
  if (!cohort) {
    alert('기수를 먼저 선택하세요.');
    return;
  }
  const select = document.getElementById('cohort-repo-select');
  const missionRepoId = Number(select.value);
  if (!missionRepoId) {
    alert('레포를 선택하세요.');
    return;
  }
  const levelRaw = document.getElementById('cohort-repo-level').value;
  const level = levelRaw ? Number(levelRaw) : null;
  const order = Number(document.getElementById('cohort-repo-order').value) || 0;

  const saveLevel = () => {
    if (levelRaw === '') return Promise.resolve();
    return updateRepoLevel(missionRepoId, level);
  };

  saveLevel()
    .then(() =>
      fetch('/admin/cohort-repos', {
        method: 'POST',
        headers: authHeaders('application/json'),
        body: JSON.stringify({ cohort, missionRepoId, order }),
      }),
    )
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then(() => {
      document.getElementById('cohort-repo-level').value = '';
      document.getElementById('cohort-repo-order').value = '';
      toast('레포 추가됨');
      loadCohortRepos();
    })
    .catch(() => alert('추가 실패 (중복일 수 있음)'));
}

export function setCohortRepoOrder(id, value) {
  const order = Number(value);
  if (isNaN(order)) return;
  fetch(`/admin/cohort-repos/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ order }),
  })
    .then(() => loadCohortRepos())
    .catch(() => alert('순서 변경 실패'));
}

export function deleteCohortRepo(id) {
  if (!confirm('이 레포를 기수 목록에서 제거하시겠습니까?')) return;
  fetch(`/admin/cohort-repos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('제거됨');
      loadCohortRepos();
    })
    .catch(() => alert('삭제 실패'));
}

export function triggerCohortSync() {
  const cohort = adminState.cohortRepoSelectedCohort ?? Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) {
    alert('기수를 먼저 선택하세요.');
    return;
  }

  const btn = document.getElementById('cohort-sync-btn');
  const progressWrap = document.getElementById('sync-progress-wrap');
  const progressBar = document.getElementById('sync-progress-bar');
  const progressLabel = document.getElementById('sync-progress-label');
  btn.disabled = true;
  btn.textContent = '동기화 중...';
  progressWrap.style.display = 'block';
  progressBar.style.width = '0%';
  progressLabel.textContent = '준비 중...';
  addLog(`${cohort}기 Sync 시작`, 'run');

  const url = `/admin/sync/stream?token=${encodeURIComponent(adminState.token)}&cohort=${cohort}`;
  const es = new EventSource(url);

  es.addEventListener('progress', (e) => {
    const { repo, done, total, synced } = JSON.parse(e.data);
    const pct = Math.round((done / total) * 100);
    progressBar.style.width = `${pct}%`;
    progressLabel.textContent = `(${done}/${total}) ${repo} — ${synced}건`;
  });

  es.addEventListener('done', (e) => {
    const { reposSynced, totalSynced } = JSON.parse(e.data);
    progressBar.style.width = '100%';
    progressLabel.textContent = `완료: ${reposSynced}개 레포, ${totalSynced}건 수집됨`;
    toast(`${cohort}기 sync 완료 (${totalSynced}건)`);
    addLog(`${cohort}기 Sync 완료 — ${reposSynced}개 레포, ${totalSynced}건 수집`, 'ok');
    es.close();
    btn.disabled = false;
    btn.textContent = '이 기수 Sync';
    Promise.all([loadStatus(), loadMembers()]);
  });

  es.addEventListener('error', (e) => {
    const msg = e.data ? JSON.parse(e.data).message : 'sync 실패';
    progressLabel.textContent = `오류: ${msg}`;
    toast(`${cohort}기 sync 실패`);
    addLog(`${cohort}기 Sync 실패: ${msg}`, 'err');
    es.close();
    btn.disabled = false;
    btn.textContent = '이 기수 Sync';
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) return;
    progressLabel.textContent = '연결 오류';
    es.close();
    btn.disabled = false;
    btn.textContent = '이 기수 Sync';
  };
}

export function autoFillCohortRepos() {
  const cohort = adminState.cohortRepoSelectedCohort ?? Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) {
    alert('기수를 먼저 선택하세요.');
    return;
  }
  fetch('/admin/cohort-repos/auto-fill', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ cohort }),
  })
    .then((r) => r.json())
    .then((data) => {
      toast(`${data.added}개 레포 자동 추가됨`);
      addLog(`기수 레포 자동 채우기 완료 — ${cohort}기, ${data.added}개 추가`, 'ok');
      loadCohortRepos();
    })
    .catch(() => {
      alert('자동 채우기 실패');
      addLog(`기수 레포 자동 채우기 실패 — ${cohort}기`, 'err');
    });
}
