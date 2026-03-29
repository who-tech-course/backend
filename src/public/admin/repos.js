import { addLog } from './logs.js';
import { adminState, REPO_PAGE_SIZE } from './state.js';
import { authHeaders, parseErrorResponse } from './http.js';
import { escapeHtml, parseJsonOrNull, toast } from './utils.js';
import { loadStatus } from './workspace.js';

export function loadRepos() {
  return fetch('/admin/repos', { headers: authHeaders() })
    .then((response) => response.json())
    .then((repos) => {
      adminState.repoList = repos;
      renderRepos();
      populateCohortRepoSelect();
    });
}

export function setRepoTab(tab) {
  adminState.repoTab = tab;
  adminState.repoPageContinuous = 1;
  adminState.repoPageOnce = 1;
  document.getElementById('tab-base').classList.toggle('active', tab === 'base');
  document.getElementById('tab-common').classList.toggle('active', tab === 'common');
  document.getElementById('tab-excluded').classList.toggle('active', tab === 'excluded');
  document.getElementById('tab-precourse').classList.toggle('active', tab === 'precourse');
  const trackFilter = document.getElementById('repo-track-filter');
  trackFilter.style.display = tab === 'common' || tab === 'excluded' ? 'none' : '';
  renderRepos();
}

export function getRepoTabCategory(repo) {
  return repo.tabCategory ?? (repo.status === 'excluded' ? 'excluded' : repo.track == null ? 'common' : 'base');
}

export function patchRepo(id, data) {
  return fetch(`/admin/repos/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify(data),
  })
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((updated) => {
      const idx = adminState.repoList.findIndex((r) => r.id === id);
      if (idx !== -1) adminState.repoList[idx] = { ...adminState.repoList[idx], ...updated };
      renderRepos();
      toast('저장됨');
    })
    .catch(() => toast('저장 실패'));
}

export function moveRepoCategory(id, target) {
  const repo = adminState.repoList.find((item) => item.id === id);
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
    patchRepo(id, {
      tabCategory: 'common',
      status: repo.status === 'excluded' ? 'candidate' : repo.status,
      track: null,
    });
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
  sel.onchange = () => {
    done = true;
    onSave(sel.value || null);
  };
  sel.onblur = () => {
    if (!done) {
      done = true;
      el.innerHTML = prev;
    }
  };
  sel.onkeydown = (e) => {
    if (e.key === 'Escape') {
      done = true;
      el.innerHTML = prev;
    }
  };
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
    if (val === String(current ?? '')) {
      el.innerHTML = prev;
      return;
    }
    onSave(val || null);
  };
  inp.onkeydown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      done = true;
      el.innerHTML = prev;
    }
  };
  inp.onblur = save;
}

export function inlineEditStatus(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(
    el,
    [
      { value: 'active', label: 'active' },
      { value: 'candidate', label: 'candidate' },
      { value: 'excluded', label: 'excluded' },
    ],
    repo.status,
    (val) => patchRepo(id, { status: val }),
  );
}

export function inlineEditSyncMode(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(
    el,
    [
      { value: 'continuous', label: '계속' },
      { value: 'once', label: '1회' },
    ],
    repo.syncMode,
    (val) => patchRepo(id, { syncMode: val }),
  );
}

export function inlineEditTrack(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(
    el,
    [
      { value: null, label: '공통' },
      { value: 'frontend', label: 'frontend' },
      { value: 'backend', label: 'backend' },
      { value: 'android', label: 'android' },
    ],
    repo.track,
    (val) => patchRepo(id, { track: val }),
  );
}

export function inlineEditType(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineSelect(
    el,
    [
      { value: 'individual', label: 'individual' },
      { value: 'integration', label: 'integration' },
    ],
    repo.type,
    (val) => patchRepo(id, { type: val }),
  );
}

export function inlineEditLevel(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(
    el,
    repo.level != null ? String(repo.level) : '',
    (val) => patchRepo(id, { level: val ? Number(val) : null }),
    'number',
  );
}

export function updateRepoLevel(repoId, level) {
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
      const idx = adminState.repoList.findIndex((r) => r.id === repoId);
      if (idx !== -1) adminState.repoList[idx] = { ...adminState.repoList[idx], ...updated };
      return updated;
    });
}

export function changeCohortRepoLevel(repoId, value) {
  const level = value ? Number(value) : null;
  if (value && Number.isNaN(level)) return;
  updateRepoLevel(repoId, level)
    .then(async () => {
      const { loadCohortRepos } = await import('./cohort-repos.js');
      loadCohortRepos();
    })
    .catch(() => alert('레벨 변경 실패'));
}

export function inlineEditCohorts(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(el, repo.cohorts?.join(', ') ?? '', (val) => {
    const cohorts = val
      ? val
          .split(',')
          .map((c) => Number(c.trim()))
          .filter((n) => !isNaN(n) && n > 0)
      : null;
    patchRepo(id, { cohorts });
  });
}

export function inlineEditDescription(el, id) {
  const repo = adminState.repoList.find((r) => r.id === id);
  if (!repo) return;
  inlineText(el, repo.description ?? '', (val) => patchRepo(id, { description: val }));
}

export function repoRow(repo) {
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
          <button class="btn-sm btn-ghost" onclick="resetSync(${repo.id})">초기화</button>
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

export function resetRepoPages() {
  adminState.repoPageContinuous = 1;
  adminState.repoPageOnce = 1;
}

export function setRepoContinuousPage(p) {
  adminState.repoPageContinuous = p;
  renderRepos();
}

export function setRepoOncePage(p) {
  adminState.repoPageOnce = p;
  renderRepos();
}

export function renderRepos() {
  const search = document.getElementById('repo-search').value.trim().toLowerCase();
  const statusFilter = document.getElementById('repo-status-filter').value;
  const track = document.getElementById('repo-track-filter').value;

  const filtered = adminState.repoList.filter((repo) => {
    const category = getRepoTabCategory(repo);
    if (adminState.repoTab !== category) return false;
    const status = adminState.repoTab === 'excluded' ? 'excluded' : statusFilter;
    if (search && !repo.name.toLowerCase().includes(search)) return false;
    if (status && repo.status !== status) return false;
    if (track && repo.track !== track) return false;
    return true;
  });

  const continuous = filtered.filter((r) => r.syncMode !== 'once');
  const once = filtered.filter((r) => r.syncMode === 'once');

  renderPagedRepos('repo-table-body-continuous', 'repo-pagination-continuous', continuous, adminState.repoPageContinuous, 'continuous');
  renderPagedRepos('repo-table-body-once', 'repo-pagination-once', once, adminState.repoPageOnce, 'once');
}

function renderPagedRepos(tbodyId, paginationId, repos, page, pageKind) {
  const tbody = document.getElementById(tbodyId);
  const paginationEl = document.getElementById(paginationId);
  const totalPages = Math.max(1, Math.ceil(repos.length / REPO_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = repos.slice((safePage - 1) * REPO_PAGE_SIZE, safePage * REPO_PAGE_SIZE);

  tbody.innerHTML = paged.length ? paged.map(repoRow).join('') : `<tr><td colspan="8" class="muted">없음</td></tr>`;

  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }

  const setFn = pageKind === 'continuous' ? 'setRepoContinuousPage' : 'setRepoOncePage';

  paginationEl.innerHTML = `
    <div class="pagination">
      <button class="btn-sm btn-ghost" ${safePage <= 1 ? 'disabled' : ''} onclick="${setFn}(${safePage - 1})">이전</button>
      <span class="sub">${safePage} / ${totalPages} (${repos.length}개)</span>
      <button class="btn-sm btn-ghost" ${safePage >= totalPages ? 'disabled' : ''} onclick="${setFn}(${safePage + 1})">다음</button>
    </div>
  `;
}

export function discoverRepos() {
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
    .catch(() => {
      toast('후보 불러오기 실패');
      addLog('레포 후보 불러오기 실패', 'err');
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = '후보 불러오기';
    });
}

export function addRepo() {
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

export function editRepoRegex(id) {
  const repo = adminState.repoList.find((item) => item.id === id);
  if (!repo) return;

  adminState.regexModalRepoId = id;
  adminState.regexModalResult = null;
  adminState.regexModalMode = 'edit';

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

export function deleteAllRepos() {
  if (!confirm('모든 레포와 관련 submission을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/repos', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 레포 삭제 완료');
      addLog('전체 레포 삭제 완료', 'ok');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

export function deleteRepo(id) {
  if (!confirm('레포와 관련 submission을 함께 삭제합니다. 계속할까요?')) return;
  const repo = adminState.repoList.find((r) => r.id === id);

  fetch(`/admin/repos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('레포 삭제 완료');
      addLog(`레포 삭제 — ${repo?.name ?? `#${id}`}`, 'ok');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('레포 삭제에 실패했습니다.'));
}

export function populateCohortRepoSelect() {
  const select = document.getElementById('cohort-repo-select');
  if (!select) return;
  const trackFilter = document.getElementById('cohort-repo-track-filter')?.value ?? '';
  const filtered = trackFilter ? adminState.repoList.filter((r) => r.track === trackFilter) : adminState.repoList;
  select.innerHTML =
    '<option value="">레포 선택</option>' +
    filtered
      .map(
        (r) =>
          `<option value="${r.id}">[${r.status}] ${escapeHtml(r.name)}${r.level != null ? ` (레벨${r.level})` : ''}</option>`,
      )
      .join('');
}
