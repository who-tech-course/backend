/* eslint-disable @typescript-eslint/no-unused-vars */
let token = localStorage.getItem('admin_token') ?? '';
let repoList = [];
let memberList = [];
let memberSearchTimer = null;
let repoTab = 'base';
let regexModalRepoId = null;
let regexModalResult = null;
let regexModalMode = 'detect'; // 'detect' | 'edit'
let repoPageContinuous = 1;
let repoPageOnce = 1;
const REPO_PAGE_SIZE = 20;

function roleLabel(role) {
  return role === 'coach' ? '코치' : role === 'reviewer' ? '리뷰어' : '크루';
}

function login() {
  token = document.getElementById('secret-input').value;
  fetch('/admin/status', { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error('unauthorized');
      localStorage.setItem('admin_token', token);
      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
      return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers(), loadActivityLogs()]);
    })
    .catch(() => alert('잘못된 비밀키입니다.'));
}

function tryAutoLogin() {
  if (!token) return;
  fetch('/admin/status', { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) { localStorage.removeItem('admin_token'); return; }
      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
      return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers(), loadActivityLogs()]);
    })
    .catch(() => { localStorage.removeItem('admin_token'); });
}

function authHeaders(contentType) {
  const headers = { Authorization: `Bearer ${token}` };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

function parseErrorResponse(response) {
  return response
    .json()
    .catch(() => ({}))
    .then((body) => Promise.reject({
      status: response.status,
      message: body?.message ?? response.statusText ?? 'request failed',
      ...body,
    }));
}

function loadStatus() {
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

function loadWorkspace() {
  return fetch('/admin/workspace', { headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('nickname-regex').value = data.nicknameRegex;
      document.getElementById('cohort-rules').value = JSON.stringify(data.cohortRules, null, 2);
      updateBlogSyncToggle(data.blogSyncEnabled);
    });
}

let blogSyncCountdownTimer = null;

function updateBlogSyncToggle(enabled) {
  const btn = document.getElementById('blog-sync-toggle');
  if (!btn) return;
  btn.classList.toggle('active', enabled);

  clearInterval(blogSyncCountdownTimer);
  blogSyncCountdownTimer = null;

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
    blogSyncCountdownTimer = setInterval(updateCountdown, 1000);
  } else {
    btn.textContent = '블로그 자동수집 OFF';
  }
}

function toggleBlogSync() {
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

function loadRepos() {
  return fetch('/admin/repos', { headers: authHeaders() })
    .then((response) => response.json())
    .then((repos) => {
      repoList = repos;
      renderRepos();
      populateCohortRepoSelect();
    });
}

function setRepoTab(tab) {
  repoTab = tab;
  repoPageContinuous = 1;
  repoPageOnce = 1;
  document.getElementById('tab-base').classList.toggle('active', tab === 'base');
  document.getElementById('tab-common').classList.toggle('active', tab === 'common');
  document.getElementById('tab-excluded').classList.toggle('active', tab === 'excluded');
  document.getElementById('tab-precourse').classList.toggle('active', tab === 'precourse');
  const trackFilter = document.getElementById('repo-track-filter');
  trackFilter.style.display = tab === 'common' || tab === 'excluded' ? 'none' : '';
  renderRepos();
}

function getRepoTabCategory(repo) {
  return repo.tabCategory ?? (repo.status === 'excluded' ? 'excluded' : repo.track == null ? 'common' : 'base');
}

function patchRepo(id, data) {
  return fetch(`/admin/repos/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify(data),
  })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((updated) => {
      const idx = repoList.findIndex((r) => r.id === id);
      if (idx !== -1) repoList[idx] = { ...repoList[idx], ...updated };
      renderRepos();
      toast('저장됨');
    })
    .catch(() => toast('저장 실패'));
}

function moveRepoCategory(id, target) {
  const repo = repoList.find((item) => item.id === id);
  if (!repo) return;

  if (target === 'precourse') {
    patchRepo(id, { tabCategory: 'precourse', status: repo.status === 'excluded' ? 'candidate' : repo.status });
    return;
  }

  if (target === 'excluded') {
    patchRepo(id, { tabCategory: 'excluded', status: 'excluded' });
    return;
  }

  if (target === 'common') {
    patchRepo(id, { tabCategory: 'common', status: repo.status === 'excluded' ? 'candidate' : repo.status, track: null });
    return;
  }

  if (target === 'base') {
    if (repo.track == null) {
      toast('기준 레포로 옮기려면 먼저 트랙을 지정하세요.');
      return;
    }
    patchRepo(id, { tabCategory: 'base', status: repo.status === 'excluded' ? 'candidate' : repo.status });
  }
}

function inlineSelect(el, options, current, onSave) {
  const prev = el.innerHTML;
  const sel = document.createElement('select');
  sel.className = 'inline-sel';
  options.forEach(({ value, label }) => {
    const o = document.createElement('option');
    o.value = value ?? '';
    o.textContent = label;
    if ((value ?? '') === (current ?? '')) o.selected = true;
    sel.appendChild(o);
  });
  el.innerHTML = '';
  el.appendChild(sel);
  sel.focus();
  let done = false;
  sel.onclick = (e) => e.stopPropagation();
  sel.onchange = () => { done = true; onSave(sel.value || null); };
  sel.onblur = () => { if (!done) { done = true; el.innerHTML = prev; } };
  sel.onkeydown = (e) => { if (e.key === 'Escape') { done = true; el.innerHTML = prev; } };
}

function inlineText(el, current, onSave, inputType = 'text') {
  const prev = el.innerHTML;
  const inp = document.createElement('input');
  inp.className = 'inline-inp';
  inp.type = inputType;
  inp.value = current ?? '';
  el.innerHTML = '';
  el.appendChild(inp);
  inp.onclick = (e) => e.stopPropagation();
  inp.focus();
  inp.select();
  let done = false;
  const save = () => {
    if (done) return;
    done = true;
    const val = inp.value.trim();
    if (val === String(current ?? '')) { el.innerHTML = prev; return; }
    onSave(val || null);
  };
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { done = true; el.innerHTML = prev; }
  };
  inp.onblur = save;
}

function inlineEditStatus(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(el, [{ value: 'active', label: 'active' }, { value: 'candidate', label: 'candidate' }, { value: 'excluded', label: 'excluded' }], repo.status, (val) => patchRepo(id, { status: val }));
}

function inlineEditSyncMode(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(el, [{ value: 'continuous', label: '계속' }, { value: 'once', label: '1회' }], repo.syncMode, (val) => patchRepo(id, { syncMode: val }));
}

function inlineEditTrack(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(el, [{ value: null, label: '공통' }, { value: 'frontend', label: 'frontend' }, { value: 'backend', label: 'backend' }, { value: 'android', label: 'android' }], repo.track, (val) => patchRepo(id, { track: val }));
}

function inlineEditType(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(el, [{ value: 'individual', label: 'individual' }, { value: 'integration', label: 'integration' }], repo.type, (val) => patchRepo(id, { type: val }));
}

function inlineEditLevel(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(el, repo.level != null ? String(repo.level) : '', (val) => patchRepo(id, { level: val ? Number(val) : null }), 'number');
}

function updateRepoLevel(repoId, level) {
  return fetch(`/admin/repos/${repoId}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ level }),
  })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((updated) => {
      const idx = repoList.findIndex((r) => r.id === repoId);
      if (idx !== -1) repoList[idx] = { ...repoList[idx], ...updated };
      return updated;
    });
}

function changeCohortRepoLevel(repoId, value) {
  const level = value ? Number(value) : null;
  if (value && Number.isNaN(level)) return;
  updateRepoLevel(repoId, level)
    .then(() => loadCohortRepos())
    .catch(() => alert('레벨 변경 실패'));
}

function inlineEditCohorts(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(el, repo.cohorts?.join(', ') ?? '', (val) => {
    const cohorts = val ? val.split(',').map((c) => Number(c.trim())).filter((n) => !isNaN(n) && n > 0) : null;
    patchRepo(id, { cohorts });
  });
}

function inlineEditDescription(el, id) {
  const repo = repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(el, repo.description ?? '', (val) => patchRepo(id, { description: val }));
}

function repoRow(repo) {
  const syncedAt = repo.lastSyncAt ? new Date(repo.lastSyncAt).toLocaleString('ko-KR') : '없음';
  const hasCustomRegex = !!(repo.nicknameRegex || repo.cohortRegexRules?.length);
  const currentCategory = getRepoTabCategory(repo);
  const tabButtons = [
    { key: 'base', label: '기준', disabled: repo.track == null },
    { key: 'common', label: '공통', disabled: false },
    { key: 'excluded', label: '제외', disabled: false },
    { key: 'precourse', label: '프리코스', disabled: false },
  ]
    .map(({ key, label, disabled }) => {
      const active = currentCategory === key;
      const classes = `btn-sm tab-choice${active ? ' active' : ''}`;
      const attrs = disabled && !active ? 'disabled' : `onclick="moveRepoCategory(${repo.id}, '${key}')"`; 
      return `<button class="${classes}" ${attrs}>${label}</button>`;
    })
    .join('');
  const cohortsHtml = repo.cohorts?.length
    ? repo.cohorts.map((c) => `<span class="pill cohort">${c}기</span>`).join(' ')
    : '<span class="muted">-</span>';
  return `
    <tr>
      <td>
        <div class="stack">
          <strong>${escapeHtml(repo.name)}</strong>
          <a class="link" href="${repo.repoUrl}" target="_blank">${repo.repoUrl}</a>
        </div>
      </td>
      <td>
        <div class="stack repo-status-stack">
          <span class="pill ${repo.status} editable" onclick="inlineEditStatus(this, ${repo.id})">${repo.status}</span>
          <span class="editable muted small" onclick="inlineEditSyncMode(this, ${repo.id})">${repo.syncMode === 'once' ? '1회' : '계속'}</span>
        </div>
      </td>
      <td>
        <div class="stack">
          <span class="editable" onclick="inlineEditTrack(this, ${repo.id})">${repo.track == null ? '공통' : repo.track}</span>
          <span class="muted">
            <span class="editable" onclick="inlineEditType(this, ${repo.id})">${repo.type}</span><span class="editable" onclick="inlineEditLevel(this, ${repo.id})">${repo.level != null ? ` · 레벨${repo.level}` : ' · 레벨-'}</span>
          </span>
        </div>
      </td>
      <td>
        <span class="editable" onclick="inlineEditCohorts(this, ${repo.id})">${cohortsHtml}</span>
      </td>
      <td>
        <div class="stack">
          <span class="editable" onclick="inlineEditDescription(this, ${repo.id})">${escapeHtml(repo.description ?? '-')}</span>
          <span class="muted">${escapeHtml(repo.candidateReason ?? '-')}</span>
        </div>
      </td>
      <td style="cursor:pointer" onclick="editRepoRegex(${repo.id})" title="클릭해서 정규식 수정">
        ${hasCustomRegex ? '<span class="pill active" style="font-size:11px">있음</span>' : '<span class="pill" style="font-size:11px;background:#f1f5f9;color:#64748b">기본값</span>'}
      </td>
      <td class="muted small">${syncedAt}</td>
      <td>
        <div class="actions">
          <button class="btn-sm btn-secondary" onclick="syncRepo(${repo.id}, this)">Sync</button>
          <button class="btn-sm btn-ghost" onclick="detectRepoRegex(${repo.id})">감지</button>
          <button class="btn-sm btn-danger" onclick="deleteRepo(${repo.id})">삭제</button>
        </div>
        <div class="tab-choice-group" style="margin-top:6px">
          ${tabButtons}
        </div>
      </td>
    </tr>
  `;
}

function resetRepoPages() {
  repoPageContinuous = 1;
  repoPageOnce = 1;
}

function renderRepos() {
  const search = document.getElementById('repo-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('repo-status-filter').value;
  const track = document.getElementById('repo-track-filter').value;

  const filtered = repoList.filter((repo) => {
    const category = getRepoTabCategory(repo);
    if (repoTab !== category) return false;
    const status = repoTab === 'excluded' ? 'excluded' : statusFilter;
    if (search && !repo.name.toLowerCase().includes(search)) return false;
    if (status && repo.status !== status) return false;
    if (track && repo.track !== track) return false;
    return true;
  });

  const continuous = filtered.filter((r) => r.syncMode !== 'once');
  const once = filtered.filter((r) => r.syncMode === 'once');

  renderPagedRepos('repo-table-body-continuous', 'repo-pagination-continuous', continuous, repoPageContinuous, (p) => {
    repoPageContinuous = p;
    renderRepos();
  });
  renderPagedRepos('repo-table-body-once', 'repo-pagination-once', once, repoPageOnce, (p) => {
    repoPageOnce = p;
    renderRepos();
  });
}

function renderPagedRepos(tbodyId, paginationId, repos, page, onPageChange) {
  const tbody = document.getElementById(tbodyId);
  const paginationEl = document.getElementById(paginationId);
  const totalPages = Math.max(1, Math.ceil(repos.length / REPO_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = repos.slice((safePage - 1) * REPO_PAGE_SIZE, safePage * REPO_PAGE_SIZE);

  tbody.innerHTML = paged.length
    ? paged.map(repoRow).join('')
    : `<tr><td colspan="8" class="muted">없음</td></tr>`;

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  paginationEl.innerHTML = `
    <div class="pagination">
      <button class="btn-sm btn-ghost" ${safePage <= 1 ? 'disabled' : ''} onclick="(${onPageChange.toString()})(${safePage - 1})">이전</button>
      <span class="sub">${safePage} / ${totalPages} (${repos.length}개)</span>
      <button class="btn-sm btn-ghost" ${safePage >= totalPages ? 'disabled' : ''} onclick="(${onPageChange.toString()})(${safePage + 1})">다음</button>
    </div>
  `;
}

function activateRepo(id, syncMode) {
  fetch(`/admin/repos/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ status: 'active', syncMode }),
  })
    .then(() => {
      toast(`레포 활성화 완료 (${syncMode === 'once' ? '한 번만' : '계속'})`);
      return loadRepos();
    })
    .catch(() => alert('활성화에 실패했습니다.'));
}

function discoverRepos() {
  const button = document.getElementById('discover-btn');
  button.disabled = true;
  button.textContent = '불러오는 중...';
  addLog('레포 후보 불러오는 중...', 'run');

  fetch('/admin/repos/discover', { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((result) => {
      toast(`후보 ${result.discovered}개 분석, 생성 ${result.created}개, 갱신 ${result.updated}개`);
      addLog(`레포 후보 완료 — 분석 ${result.discovered}개, 신규 ${result.created}개, 갱신 ${result.updated}개`, 'ok');
      return loadRepos();
    })
    .catch(() => { toast('후보 불러오기 실패'); addLog('레포 후보 불러오기 실패', 'err'); })
    .finally(() => {
      button.disabled = false;
      button.textContent = '후보 불러오기';
    });
}

function addRepo() {
  const payload = {
    name: document.getElementById('repo-name').value.trim(),
    repoUrl: document.getElementById('repo-url').value.trim(),
    description: document.getElementById('repo-description').value.trim() || null,
    track: document.getElementById('repo-track').value || null,
    type: document.getElementById('repo-type').value,
    tabCategory: document.getElementById('repo-tab-category').value,
    status: document.getElementById('repo-status').value,
    syncMode: document.getElementById('repo-sync-mode').value,
    nicknameRegex: document.getElementById('repo-regex').value.trim() || null,
    cohortRegexRules: parseJsonOrNull(document.getElementById('repo-cohort-regex-rules').value.trim()),
  };

  if (!payload.name || !payload.repoUrl) {
    alert('레포 이름과 URL을 입력하세요.');
    return;
  }

  fetch('/admin/repos', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('failed');
      }
      return response.json();
    })
    .then(() => {
      ['repo-name', 'repo-url', 'repo-description', 'repo-regex', 'repo-cohort-regex-rules'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      document.getElementById('repo-tab-category').value = 'base';
      toast('레포 추가 완료');
      return loadRepos();
    })
    .catch(() => alert('레포 추가에 실패했습니다.'));
}

function editRepoRegex(id) {
  const repo = repoList.find((item) => item.id === id);
  if (!repo) return;

  regexModalRepoId = id;
  regexModalResult = null;
  regexModalMode = 'edit';

  const modal = document.getElementById('regex-modal');
  const body = document.getElementById('regex-modal-body');
  const applyBtn = document.getElementById('regex-apply-btn');
  const title = document.getElementById('regex-modal-title');

  title.textContent = `정규식 수정 — ${repo.name}`;
  applyBtn.disabled = false;

  const cohortVal = repo.cohortRegexRules?.length ? JSON.stringify(repo.cohortRegexRules, null, 2) : '';
  body.innerHTML = `
    <div style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-size:13px;">기본 닉네임 정규식</label>
      <input type="text" id="edit-regex-nickname" value="${escapeHtml(repo.nicknameRegex ?? '')}" placeholder="없으면 workspace 기본값 사용" style="width:100%" />
    </div>
    <div>
      <label style="display:block;margin-bottom:4px;font-size:13px;">기수별 정규식 JSON</label>
      <textarea id="edit-regex-cohort" rows="5" placeholder='[{"cohort":7,"nicknameRegex":"..."}]' style="width:100%;font-family:monospace">${escapeHtml(cohortVal)}</textarea>
    </div>
  `;
  modal.style.display = 'flex';
}


function deleteAllRepos() {
  if (!confirm('모든 레포와 관련 submission을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/repos', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 레포 삭제 완료');
      addLog('전체 레포 삭제 완료', 'ok');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

function deleteRepo(id) {
  if (!confirm('레포와 관련 submission을 함께 삭제합니다. 계속할까요?')) return;
  const repo = repoList.find((r) => r.id === id);

  fetch(`/admin/repos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('레포 삭제 완료');
      addLog(`레포 삭제 — ${repo?.name ?? `#${id}`}`, 'ok');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('레포 삭제에 실패했습니다.'));
}

function pollRepoSyncJob(jobId, { name, button, defaultButtonText, doneLabel, doneToast, failLabel }) {
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
          button.textContent =
            job.status === 'queued' ? '대기 중...' : `${Math.max(job.progress?.percent ?? 0, 1)}%`;
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


function syncRepo(id, button) {
  const repo = repoList.find((r) => r.id === id);
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
    })
}

function triggerSync() {
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
  const url = `/admin/sync/stream?token=${encodeURIComponent(token)}${cohortParam}`;
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

function triggerTsAndLearningTest() {
  const repo = repoList.find((item) => item.name === 'ts-and-learning');
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

function triggerBlogSync() {
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

function triggerBlogBackfill() {
  const button = document.getElementById('blog-backfill-btn');
  button.disabled = true;
  button.textContent = '조회 중...';
  const cohortVal = document.getElementById('sync-cohort').value.trim();
  const cohortParam = cohortVal ? `&cohort=${encodeURIComponent(cohortVal)}` : '';
  addLog(`블로그 링크 백필 중${cohortVal ? ` (${cohortVal}기)` : ''}...`, 'run');
  fetch(`/admin/blog/backfill?limit=30${cohortParam}`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      const failureText = data.failures.length > 0
        ? ` / 실패 예시: ${data.failures.map((item) => `${item.githubId}(${item.reason})`).join(', ')}`
        : '';
      document.getElementById('sync-result').textContent =
        `블로그 링크 확인 ${data.checked}명, 저장 ${data.updated}명, 비어 있음 ${data.missing}명, 실패 ${data.failed}명${failureText}`;
      toast(`블로그 링크 백필 완료 (${data.updated}명 저장)`);
      addLog(`블로그 백필 완료 — 확인 ${data.checked}명, 저장 ${data.updated}명, 없음 ${data.missing}명, 실패 ${data.failed}명`, 'ok');
      return loadMembers();
    })
    .catch(() => { toast('블로그 링크 백필 실패'); addLog('블로그 백필 실패', 'err'); })
    .finally(() => {
      button.disabled = false;
      button.textContent = '블로그 링크 백필';
    });
}

function loadMembers() {
  const q = document.getElementById('member-search').value.trim();
  const cohort = document.getElementById('member-cohort-filter').value;
  const role = document.getElementById('member-role-filter').value;
  const track = document.getElementById('member-track-filter').value;
  const hasBlog = document.getElementById('member-blog-filter').value;
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (cohort) params.set('cohort', cohort);
  if (role) params.set('role', role);
  if (track) params.set('track', track);
  if (hasBlog) params.set('hasBlog', hasBlog);

  return fetch(`/admin/members?${params.toString()}`, { headers: authHeaders() })
    .then((response) => response.json())
    .then((members) => {
      memberList = members;
      renderMembers();
    });
}

function debouncedLoadMembers() {
  clearTimeout(memberSearchTimer);
  memberSearchTimer = setTimeout(loadMembers, 180);
}

function renderMembers() {
  const tbody = document.getElementById('member-table-body');
  const summary = document.getElementById('member-summary');

  if (memberList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">조건에 맞는 멤버가 없습니다.</td></tr>`;
    summary.textContent = '총 0명';
    return;
  }

  tbody.innerHTML = memberList.map((member) => `
    <tr>
      <td>
        <div class="stack inline">
          <a href="https://github.com/${member.githubId}" target="_blank" style="display:block">
            ${member.avatarUrl
              ? `<img class="avatar" src="${member.avatarUrl}" alt="${escapeHtml(member.githubId)} avatar" />`
              : `<span class="avatar-fallback">${escapeHtml((member.githubId ?? '?').slice(0, 2).toUpperCase())}</span>`}
          </a>
          <div class="stack">
            <strong>${escapeHtml(member.githubId)}</strong>
            <a class="link" href="https://github.com/${member.githubId}" target="_blank">GitHub${member.githubUserId ? ` #${member.githubUserId}` : ''}</a>
          </div>
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${escapeHtml(member.nickname ?? '-')}</strong>
          <span class="muted">manual: ${escapeHtml(member.manualNickname ?? '-')}</span>
        </div>
      </td>
      <td>${renderMemberRoleButtons(member)}</td>
      <td>${member.cohort ? `<span class="pill cohort">${member.cohort}기</span>` : '-'}</td>
      <td>
        ${member.tracks.length > 0 ? `
          <div class="track-list">
            ${member.tracks.map((track) => `<span class="track-badge ${track}">${track == null ? '공통' : track}</span>`).join('')}
          </div>
        ` : '-'}
      </td>
      <td>
        ${
          member._count.submissions > 0
            ? `<button class="btn-sm btn-ghost" onclick="openSubmissionModal(${member.id}, '${escapeHtml(member.nickname ?? member.githubId)}')">${member._count.submissions}건 보기</button>`
            : '<span class="muted">0건</span>'
        }
      </td>
      <td>
        ${member.blog
          ? `<a class="link" href="${member.blog}" target="_blank" onclick="event.stopPropagation()">${member.blog}</a>
             ${member.blogPostsLatest?.length > 0 ? `<button class="btn-sm btn-ghost" style="margin-top:4px" onclick="openBlogModal(${member.id}, '${escapeHtml(member.nickname ?? member.githubId)}')">글 보기</button>` : ''}`
          : '-'}
      </td>
      <td>
        ${renderRssStatus(member)}
      </td>
      <td>
        ${member.blogPostsLatest.length > 0 ? `
          <div class="post-list">
            ${member.blogPostsLatest.map((post) => `
              <div class="post-item">
                <a href="${post.url}" target="_blank">${escapeHtml(post.title)}</a>
                <div class="muted">${new Date(post.publishedAt).toLocaleDateString('ko-KR')}</div>
              </div>
            `).join('')}
          </div>
        ` : '-'}
      </td>
      <td>
        <div class="actions">
          <button class="btn-sm btn-ghost" onclick="refreshMemberProfile(${member.id}, '${escapeHtml(member.githubId)}')">프로필</button>
          <button class="btn-sm btn-ghost" onclick="editMember(${member.id})">수정</button>
          <button class="btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');

  const cohortCounts = {};
  for (const m of memberList) {
    const key = m.cohort ? `${m.cohort}기` : '기수 미상';
    cohortCounts[key] = (cohortCounts[key] ?? 0) + 1;
  }
  const cohortSummary = Object.entries(cohortCounts)
    .sort((a, b) => {
      const an = parseInt(a[0]);
      const bn = parseInt(b[0]);
      if (isNaN(an)) return 1;
      if (isNaN(bn)) return -1;
      return bn - an;
    })
    .map(([k, v]) => `${k} ${v}명`)
    .join(' · ');
  summary.textContent = `총 ${memberList.length}명` + (cohortSummary ? `  |  ${cohortSummary}` : '');
}

function renderMemberRoleButtons(member) {
  const roles = member.roles?.length ? member.roles : ['crew'];
  return `
    <div class="role-toggle-group">
      ${['crew', 'coach', 'reviewer'].map((role) => `
        <button
          class="btn-sm role-toggle ${roles.includes(role) ? `active ${role}` : ''}"
          onclick="toggleMemberRole(${member.id}, '${role}')"
        >${roleLabel(role)}</button>
      `).join('')}
    </div>
  `;
}

function renderRssStatus(member) {
  if (!member.blog) {
    return '<span class="muted">블로그 없음</span>';
  }

  const label = member.rssStatus === 'available'
    ? 'RSS 가능'
    : member.rssStatus === 'unavailable'
      ? 'RSS 없음'
      : member.rssStatus === 'error'
        ? '확인 실패'
        : '확인 전';

  const extra = [
    member.rssUrl ? `<div class="muted">${escapeHtml(member.rssUrl)}</div>` : '',
    member.rssError ? `<div class="muted">${escapeHtml(member.rssError)}</div>` : '',
    member.rssCheckedAt ? `<div class="muted">${new Date(member.rssCheckedAt).toLocaleString('ko-KR')}</div>` : '',
  ].filter(Boolean).join('');

  return `<div class="stack"><span class="pill rss ${member.rssStatus ?? 'unknown'}">${label}</span>${extra}</div>`;
}

function addMember() {
  const githubId = document.getElementById('new-member-github').value.trim();
  if (!githubId) {
    alert('GitHub ID를 입력하세요.');
    return;
  }

  const nickname = document.getElementById('new-member-nickname').value.trim() || null;
  const cohortVal = document.getElementById('new-member-cohort').value.trim();
  const cohort = cohortVal ? Number(cohortVal) : null;
  const roles = ['crew', 'coach', 'reviewer'].filter(
    (r) => document.getElementById(`new-member-role-${r}`).checked,
  );
  if (roles.length === 0) roles.push('crew');
  const blog = document.getElementById('new-member-blog').value.trim() || null;

  fetch('/admin/members', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ githubId, nickname, cohort, roles, blog }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      ['new-member-github', 'new-member-nickname', 'new-member-cohort', 'new-member-blog'].forEach(
        (id) => { document.getElementById(id).value = ''; },
      );
      toast('멤버 추가 완료');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('멤버 추가에 실패했습니다.'));
}

function refreshMemberProfiles() {
  const cohort = document.getElementById('member-cohort-filter').value;
  const params = new URLSearchParams({ limit: '50', staleHours: '24' });
  if (cohort) params.set('cohort', cohort);

  fetch(`/admin/members/refresh-profiles?${params.toString()}`, {
    method: 'POST',
    headers: authHeaders(),
  })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then((result) => {
      toast(`프로필 갱신 ${result.refreshed}건`);
      addLog(`프로필 갱신 완료 — 확인 ${result.checked}명, 갱신 ${result.refreshed}명, 실패 ${result.failed}명`, result.failed ? 'err' : 'ok');
      return loadMembers();
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('프로필 갱신 실패');
      addLog(`프로필 갱신 실패: ${detail}`, 'err');
    });
}

function refreshMemberProfile(id, githubId) {
  fetch(`/admin/members/${id}/refresh-profile`, {
    method: 'POST',
    headers: authHeaders(),
  })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      return response.json();
    })
    .then(() => {
      toast('프로필 갱신 완료');
      addLog(`프로필 갱신 완료: ${githubId}`, 'ok');
      return loadMembers();
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('프로필 갱신 실패');
      addLog(`프로필 갱신 실패: ${githubId} — ${detail}`, 'err');
    });
}

function editMember(id) {
  const member = memberList.find((item) => item.id === id);
  if (!member) return;

  const manualNickname = prompt('대표 닉네임 고정값', member.manualNickname ?? member.nickname ?? '');
  if (manualNickname === null) return;

  const blog = prompt('블로그 링크', member.blog ?? '');
  if (blog === null) return;

  fetch(`/admin/members/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({
      manualNickname: manualNickname.trim() || null,
      blog: blog.trim() || null,
    }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('failed');
      toast('멤버 수정 완료');
      return loadMembers();
    })
    .catch(() => alert('멤버 수정에 실패했습니다.'));
}

function editMemberRoles(id) {
  const member = memberList.find((item) => item.id === id);
  if (!member) return;

  const current = (member.roles ?? ['crew']).join(', ');
  const rolesInput = prompt('역할 (crew / coach / reviewer, 쉼표로 구분)', current);
  if (rolesInput === null) return;
  const roles = rolesInput.split(',').map((r) => r.trim()).filter(Boolean);

  fetch(`/admin/members/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ roles: roles.length ? roles : ['crew'] }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('failed');
      toast('역할 수정 완료');
      return loadMembers();
    })
    .catch(() => alert('역할 수정에 실패했습니다.'));
}

function toggleMemberRole(id, role) {
  const member = memberList.find((item) => item.id === id);
  if (!member) return;

  const currentRoles = member.roles?.length ? [...member.roles] : ['crew'];
  let nextRoles = currentRoles.includes(role)
    ? currentRoles.filter((item) => item !== role)
    : [...currentRoles, role];

  if (nextRoles.length === 0) {
    nextRoles = ['crew'];
  }

  fetch(`/admin/members/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ roles: nextRoles }),
  })
    .then((response) => {
      if (!response.ok) return parseErrorResponse(response);
      toast('역할 수정 완료');
      return loadMembers();
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('역할 수정 실패');
      addLog(`역할 수정 실패: ${member.githubId} — ${detail}`, 'err');
    });
}

function openBlogModal(memberId, name) {
  const modal = document.getElementById('blog-modal');
  const title = document.getElementById('blog-modal-title');
  const body = document.getElementById('blog-modal-body');

  title.textContent = `${name} 블로그 글`;
  body.innerHTML = '<div class="sub" style="padding:16px">불러오는 중...</div>';
  modal.style.display = 'flex';

  fetch(`/admin/members/${memberId}/blog-posts`, { headers: authHeaders() })
    .then((res) => res.json())
    .then(({ archive, latest }) => {
      const renderList = (posts) =>
        posts.length === 0
          ? '<div class="muted" style="padding:8px 0">없음</div>'
          : posts.map((p) => `
            <div class="post-item" style="padding:8px 0;border-bottom:1px solid #f1f5f9">
              <a class="link" href="${p.url}" target="_blank">${escapeHtml(p.title)}</a>
              <div class="muted">${new Date(p.publishedAt).toLocaleDateString('ko-KR')}</div>
            </div>
          `).join('');

      body.innerHTML = `
        <div style="padding:16px">
          <div style="margin-bottom:20px">
            <div style="font-weight:600;margin-bottom:8px">최신 스냅샷 (7일) — ${latest.length}건</div>
            ${renderList(latest)}
          </div>
          <div>
            <div style="font-weight:600;margin-bottom:8px">전체 아카이브 (30일) — ${archive.length}건</div>
            ${renderList(archive)}
          </div>
        </div>
      `;
    })
    .catch(() => {
      body.innerHTML = '<div class="sub" style="padding:16px">불러오기 실패</div>';
    });
}

function closeBlogModal() {
  document.getElementById('blog-modal').style.display = 'none';
}

function openSubmissionModal(memberId, name) {
  const modal = document.getElementById('submission-modal');
  const title = document.getElementById('submission-modal-title');
  const body = document.getElementById('submission-modal-body');
  const member = memberList.find((item) => item.id === memberId);

  title.textContent = `${name} 제출 내역`;

  if (!member || member.submissions.length === 0) {
    body.innerHTML = '<div class="sub" style="padding:16px">제출 내역이 없습니다.</div>';
    modal.style.display = 'flex';
    return;
  }

  body.innerHTML = `
    <div style="padding:16px">
      <div class="pr-list" style="min-width:0">
        ${member.submissions.map((submission) => `
          <div class="post-item" style="padding:10px 0;border-bottom:1px solid #f1f5f9">
            <a href="${submission.prUrl}" target="_blank">${escapeHtml(submission.title)}</a>
            <div class="muted">${escapeHtml(submission.missionRepo.name)} · ${escapeHtml(submission.missionRepo.track == null ? '공통' : submission.missionRepo.track)}</div>
            <div class="muted">#${submission.prNumber} · ${new Date(submission.submittedAt).toLocaleDateString('ko-KR')}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

function closeSubmissionModal() {
  document.getElementById('submission-modal').style.display = 'none';
}

function deleteAllMembers() {
  if (!confirm('모든 멤버와 관련 submission, 블로그 글을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/members', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 멤버 삭제 완료');
      addLog('전체 멤버 삭제 완료', 'ok');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

function deleteMember(id) {
  if (!confirm('멤버와 관련 submission/blog 데이터를 함께 삭제합니다. 계속할까요?')) return;
  const member = memberList.find((m) => m.id === id);

  fetch(`/admin/members/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('멤버 삭제 완료');
      addLog(`멤버 삭제 — ${member?.githubId ?? `#${id}`}`, 'ok');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('멤버 삭제에 실패했습니다.'));
}

function saveWorkspace() {
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
    .then(() => { toast('Workspace 저장 완료'); addLog('Workspace 설정 저장 완료', 'ok'); })
    .catch(() => { toast('Workspace 저장 실패'); addLog('Workspace 저장 실패', 'err'); });
}

function parseJsonOrNull(value) {
  if (!value) return null;
  return JSON.parse(value);
}

function formatRepoRegex(repo) {
  const cohortRules = repo.cohortRegexRules ?? [];
  if (cohortRules.length > 0) {
    return cohortRules.map((rule) => `${rule.cohort}기: ${rule.nicknameRegex}`).join('\n');
  }

  return repo.nicknameRegex ?? 'workspace 기본 정규식';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 2600);
}

function renderLogEntry(ts, type, msg) {
  const body = document.getElementById('log-body');
  if (!body) return;
  const tags = { ok: ' OK ', err: 'ERR', run: 'RUN', info: ' ·· ' };
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  entry.innerHTML = `<span class="log-ts">${ts}</span><span class="log-tag ${type}">[${tags[type] ?? ' ·· '}]</span><span class="log-msg ${type}">${escapeHtml(msg)}</span>`;
  body.appendChild(entry);
  while (body.children.length > 200) body.removeChild(body.firstChild);
  body.scrollTop = body.scrollHeight;
  if (body.classList.contains('collapsed')) {
    body.classList.remove('collapsed');
    document.getElementById('log-toggle-btn').textContent = '접기 ▾';
  }
}

function addLog(msg, type = 'info') {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  renderLogEntry(ts, type, msg);
  fetch('/admin/logs', { method: 'POST', headers: authHeaders('application/json'), body: JSON.stringify({ type, message: msg }) }).catch(() => {});
}

function loadActivityLogs() {
  return fetch('/admin/logs', { headers: authHeaders() })
    .then((r) => r.json())
    .then((logs) => {
      const body = document.getElementById('log-body');
      if (!body) return;
      body.innerHTML = '';
      [...logs].reverse().forEach(({ type, message, createdAt }) => {
        const d = new Date(createdAt);
        const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        renderLogEntry(ts, type, message);
      });
    })
    .catch(() => {});
}

function clearActivityLog() {
  fetch('/admin/logs', { method: 'DELETE', headers: authHeaders() })
    .then(() => { const body = document.getElementById('log-body'); if (body) body.innerHTML = ''; })
    .catch(() => {});
}

function toggleActivityLog() {
  const body = document.getElementById('log-body');
  const btn = document.getElementById('log-toggle-btn');
  if (!body || !btn) return;
  const collapsed = body.classList.toggle('collapsed');
  btn.textContent = collapsed ? '펼치기 ▸' : '접기 ▾';
}

function detectRepoRegex(id) {
  regexModalRepoId = id;
  regexModalResult = null;
  regexModalMode = 'detect';

  const modal = document.getElementById('regex-modal');
  const body = document.getElementById('regex-modal-body');
  const applyBtn = document.getElementById('regex-apply-btn');

  body.innerHTML = '<div class="sub">GitHub PR을 불러오는 중...</div>';
  applyBtn.disabled = true;
  modal.style.display = 'flex';

  fetch(`/admin/repos/${id}/detect-regex`, { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error('failed');
      return response.json();
    })
    .then((result) => {
      regexModalResult = result;
      renderRegexModal(result);
      applyBtn.disabled = false;
    })
    .catch(() => {
      body.innerHTML = '<div class="sub">정규식 감지에 실패했습니다.</div>';
    });
}

function renderRegexModal(result) {
  const body = document.getElementById('regex-modal-body');
  const { samples, suggestion } = result;

  const samplesHtml = samples.map((sample) => {
    const cohortLabel = sample.cohort !== null ? `${sample.cohort}기` : '기수 불명';
    const titlesHtml = sample.titles.map((t) => `<span>${escapeHtml(t)}</span>`).join('');
    const regexVal = sample.detectedRegex ?? '';
    return `
      <div class="regex-sample">
        <div class="regex-sample-cohort">${escapeHtml(cohortLabel)}</div>
        <div class="regex-sample-titles">${titlesHtml}</div>
        <div class="regex-detected">
          <label>감지된 정규식</label>
          <div class="regex-input-wrap">
            <input type="text" class="cohort-regex-input" data-cohort="${sample.cohort ?? ''}" value="${escapeHtml(regexVal)}" placeholder="감지된 정규식 없음" />
          </div>
        </div>
      </div>
    `;
  }).join('');

  const suggestionRegex = suggestion.nicknameRegex ?? '';
  const suggestionHtml = `
    <div style="margin-bottom:16px;">
      <div class="sub" style="margin-bottom:8px;">전 기수 동일 정규식 (비워두면 기수별로 적용)</div>
      <input type="text" id="suggestion-regex-input" value="${escapeHtml(suggestionRegex)}" placeholder="기수별 정규식이 다르면 비워두세요" />
    </div>
  `;

  body.innerHTML = suggestionHtml + samplesHtml;
}

function closeRegexModal() {
  document.getElementById('regex-modal').style.display = 'none';
  regexModalRepoId = null;
  regexModalResult = null;
}

async function detectRegexAll() {
  const btn = document.getElementById('detect-regex-all-btn');
  btn.disabled = true;
  btn.textContent = '감지 중...';
  addLog('정규식 자동감지 중...', 'run');
  try {
    const res = await fetch('/admin/repos/detect-regex-all', { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();
    const applied = results.filter((r) => !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    toast(`정규식 적용 완료: ${applied.length}개 / 스킵 ${skipped.length}개`);
    addLog(`정규식 자동감지 완료 — 적용 ${applied.length}개, 스킵 ${skipped.length}개`, 'ok');
    await loadRepos();
  } catch (e) {
    alert(`정규식 자동감지 실패: ${e}`);
    addLog(`정규식 자동감지 실패: ${e}`, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = '정규식 자동감지+적용';
  }
}

function closeValidateModal() {
  document.getElementById('validate-regex-modal').style.display = 'none';
}

async function startValidateAllRegex() {
  const modal = document.getElementById('validate-regex-modal');
  const progress = document.getElementById('validate-regex-progress');
  const body = document.getElementById('validate-regex-body');
  const btn = document.getElementById('validate-regex-btn');

  modal.style.display = 'flex';
  body.innerHTML = '';
  btn.disabled = true;

  const activeRepos = repoList.filter((r) => r.status === 'active');
  addLog(`정규식 검증 시작 — active 레포 ${activeRepos.length}개`, 'run');
  const issues = [];

  for (let i = 0; i < activeRepos.length; i++) {
    const repo = activeRepos[i];
    progress.innerHTML = `<span class="sub">검증 중 ${i + 1} / ${activeRepos.length} — ${escapeHtml(repo.name)}</span>`;

    try {
      const res = await fetch(`/admin/repos/${repo.id}/validate-regex`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      if (result.unmatched > 0) {
        issues.push(result);
      }
    } catch (e) {
      issues.push({ id: repo.id, name: repo.name, error: String(e), total: 0, matched: 0, unmatched: 0, samples: [] });
    }
  }

  progress.innerHTML = `<span class="sub">완료 — ${activeRepos.length}개 검증, 이슈 ${issues.length}개</span>`;
  addLog(`정규식 검증 완료 — ${activeRepos.length}개 검증, 이슈 ${issues.length}개`, issues.length > 0 ? 'err' : 'ok');
  btn.disabled = false;

  if (issues.length === 0) {
    body.innerHTML = '<div class="sub" style="padding:16px 0">이슈 없음 ✓</div>';
    return;
  }

  body.innerHTML = issues.map((result) => renderValidateIssue(result)).join('<hr style="margin:8px 0;border-color:#e2e8f0">');
}

function renderValidateIssue(result) {
  if (result.error) {
    return `
    <div style="padding:12px 0">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div>
          <strong>${escapeHtml(result.name)}</strong>
          <span class="muted" style="margin-left:8px;color:#dc2626">${escapeHtml(result.error)}</span>
        </div>
        <button class="btn-sm btn-secondary" onclick="dismissValidateIssue(${result.id})">건너뛰기</button>
      </div>
    </div>`;
  }

  const samplesHtml = result.samples
    .map(
      (s) => `
      <div class="post-item" style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px;color:${s.matched ? '#16a34a' : '#dc2626'}">${s.matched ? '✓' : '✗'}</span>
        <span style="font-size:12px;flex:1">${escapeHtml(s.title)}</span>
        ${s.extracted ? `<span class="pill crew" style="font-size:11px">${escapeHtml(s.extracted)}</span>` : ''}
      </div>`,
    )
    .join('');

  return `
    <div style="padding:12px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div>
          <strong>${escapeHtml(result.name)}</strong>
          <span class="muted" style="margin-left:8px">${result.matched}/${result.total} 매칭</span>
        </div>
        <div class="actions">
          <button class="btn-sm btn-ghost" onclick="closeValidateModal(); editRepoRegex(${result.id})">정규식 수정</button>
          <button class="btn-sm btn-ghost" onclick="detectRepoRegex(${result.id}); closeValidateModal()">자동 감지</button>
          <button class="btn-sm btn-secondary" onclick="dismissValidateIssue(${result.id})">건너뛰기</button>
        </div>
      </div>
      <div id="validate-issue-${result.id}" class="post-list">${samplesHtml}</div>
    </div>`;
}

function dismissValidateIssue(id) {
  const el = document.getElementById(`validate-issue-${id}`);
  if (el) el.closest('div[style]').style.display = 'none';
}

function applyDetectedRegex() {
  if (!regexModalRepoId) return;

  let payload;

  if (regexModalMode === 'edit') {
    const nicknameRegex = document.getElementById('edit-regex-nickname').value.trim() || null;
    const cohortRaw = document.getElementById('edit-regex-cohort').value.trim();
    let cohortRegexRules = null;
    if (cohortRaw) {
      try {
        cohortRegexRules = JSON.parse(cohortRaw);
      } catch {
        alert('기수별 정규식 JSON 형식이 올바르지 않습니다.');
        return;
      }
    }
    payload = { nicknameRegex, cohortRegexRules };
  } else {
    if (!regexModalResult) return;
    const suggestionInput = document.getElementById('suggestion-regex-input');
    const nicknameRegex = suggestionInput ? suggestionInput.value.trim() || null : null;
    const cohortInputs = document.querySelectorAll('.cohort-regex-input');
    const cohortRegexRules = [];
    cohortInputs.forEach((input) => {
      const cohortAttr = input.getAttribute('data-cohort');
      if (!cohortAttr) return;
      const cohort = parseInt(cohortAttr, 10);
      const regex = input.value.trim();
      if (!isNaN(cohort) && regex) cohortRegexRules.push({ cohort, nicknameRegex: regex });
    });
    payload = { nicknameRegex, cohortRegexRules: cohortRegexRules.length > 0 ? cohortRegexRules : null };
  }

  fetch(`/admin/repos/${regexModalRepoId}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) throw new Error('failed');
      return response.json();
    })
    .then(() => {
      toast('정규식 저장 완료');
      closeRegexModal();
      return loadRepos();
    })
    .catch(() => alert('정규식 저장에 실패했습니다.'));
}

document.getElementById('secret-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    login();
  }
});

// ── 기수별 레포 관리 ──────────────────────────────────────────────
let cohortRepoList = [];
let cohortRepoSelectedCohort = null;

function loadCohortRepos() {
  const cohort = Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) { document.getElementById('cohort-repo-table-body').innerHTML = ''; return; }
  cohortRepoSelectedCohort = cohort;
  fetch(`/admin/cohort-repos?cohort=${cohort}`, { headers: authHeaders() })
    .then((r) => r.json())
    .then((data) => {
      cohortRepoList = data;
      renderCohortRepos();
    })
    .catch(() => toast('기수 레포 목록 불러오기 실패'));
}

function renderCohortRepos() {
  const tbody = document.getElementById('cohort-repo-table-body');
  const trackFilter = document.getElementById('cohort-repo-track-filter')?.value ?? '';
  const filtered = trackFilter
    ? cohortRepoList.filter((e) => e.missionRepo.track === trackFilter)
    : cohortRepoList;
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:16px">추가된 레포 없음</td></tr>`;
    return;
  }

  // level별 그룹핑 (null은 마지막)
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

  tbody.innerHTML = sortedLevels.flatMap((level) => {
    const entries = groups.get(level).sort((a, b) => a.order - b.order);
    const header = `<tr><td colspan="5" style="background:#f8fafc;font-size:12px;font-weight:700;color:#475569;padding:8px 14px">${level != null ? `${level}단계` : '단계 미지정'} (${entries.length}개)</td></tr>`;
    const rows = entries.map((entry) => `
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
    `);
    return [header, ...rows];
  }).join('');
}

function addCohortRepo() {
  const cohort = cohortRepoSelectedCohort;
  if (!cohort) { alert('기수를 먼저 선택하세요.'); return; }
  const select = document.getElementById('cohort-repo-select');
  const missionRepoId = Number(select.value);
  if (!missionRepoId) { alert('레포를 선택하세요.'); return; }
  const levelRaw = document.getElementById('cohort-repo-level').value;
  const level = levelRaw ? Number(levelRaw) : null;
  const order = Number(document.getElementById('cohort-repo-order').value) || 0;

  const saveLevel = () => {
    if (levelRaw === '') return Promise.resolve();
    return updateRepoLevel(missionRepoId, level);
  };

  saveLevel()
    .then(() => fetch('/admin/cohort-repos', {
      method: 'POST',
      headers: authHeaders('application/json'),
      body: JSON.stringify({ cohort, missionRepoId, order }),
    }))
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => {
      document.getElementById('cohort-repo-level').value = '';
      document.getElementById('cohort-repo-order').value = '';
      toast('레포 추가됨');
      loadCohortRepos();
    })
    .catch(() => alert('추가 실패 (중복일 수 있음)'));
}

function setCohortRepoOrder(id, value) {
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

function deleteCohortRepo(id) {
  if (!confirm('이 레포를 기수 목록에서 제거하시겠습니까?')) return;
  fetch(`/admin/cohort-repos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => { toast('제거됨'); loadCohortRepos(); })
    .catch(() => alert('삭제 실패'));
}

function triggerCohortSync() {
  const cohort = cohortRepoSelectedCohort ?? Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) { alert('기수를 먼저 선택하세요.'); return; }

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

  const url = `/admin/sync/stream?token=${encodeURIComponent(token)}&cohort=${cohort}`;
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

function autoFillCohortRepos() {
  const cohort = cohortRepoSelectedCohort ?? Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) { alert('기수를 먼저 선택하세요.'); return; }
  fetch('/admin/cohort-repos/auto-fill', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ cohort }),
  })
    .then((r) => r.json())
    .then((data) => { toast(`${data.added}개 레포 자동 추가됨`); addLog(`기수 레포 자동 채우기 완료 — ${cohort}기, ${data.added}개 추가`, 'ok'); loadCohortRepos(); })
    .catch(() => { alert('자동 채우기 실패'); addLog(`기수 레포 자동 채우기 실패 — ${cohort}기`, 'err'); });
}

function populateCohortRepoSelect() {
  const select = document.getElementById('cohort-repo-select');
  const trackFilter = document.getElementById('cohort-repo-track-filter')?.value ?? '';
  const filtered = trackFilter ? repoList.filter((r) => r.track === trackFilter) : repoList;
  select.innerHTML = '<option value="">레포 선택</option>' +
    filtered
      .map((r) => `<option value="${r.id}">[${r.status}] ${escapeHtml(r.name)}${r.level != null ? ` (레벨${r.level})` : ''}</option>`)
      .join('');
}
