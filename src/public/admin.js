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
      return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers()]);
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
      return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers()]);
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
  const trackFilter = document.getElementById('repo-track-filter');
  trackFilter.style.display = tab === 'common' ? 'none' : '';
  renderRepos();
}

function repoRow(repo) {
  const syncedAt = repo.lastSyncAt ? new Date(repo.lastSyncAt).toLocaleString('ko-KR') : '없음';
  const hasCustomRegex = !!(repo.nicknameRegex || repo.cohortRegexRules?.length);
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
      <td><span class="pill ${repo.status}">${repo.status}</span></td>
      <td>
        <div class="stack">
          <span>${repo.track == null ? '공통' : repo.track}</span>
          <span class="muted">${repo.type}${repo.level != null ? ` · 레벨${repo.level}` : ''}</span>
        </div>
      </td>
      <td>${cohortsHtml}</td>
      <td>
        <div class="stack">
          <span>${escapeHtml(repo.description ?? '-')}</span>
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
          <button class="btn-sm btn-ghost" onclick="editRepo(${repo.id})">수정</button>
          <button class="btn-sm btn-danger" onclick="deleteRepo(${repo.id})">삭제</button>
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
  const status = document.getElementById('repo-status-filter').value;
  const track = document.getElementById('repo-track-filter').value;

  const filtered = repoList.filter((repo) => {
    const isCommon = repo.track === null;
    if (repoTab === 'base' && isCommon) return false;
    if (repoTab === 'common' && !isCommon) return false;
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

  fetch('/admin/repos/discover', { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((result) => {
      toast(`후보 ${result.discovered}개 분석, 생성 ${result.created}개, 갱신 ${result.updated}개`);
      return loadRepos();
    })
    .catch(() => toast('후보 불러오기 실패'))
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

function editRepo(id) {
  const repo = repoList.find((item) => item.id === id);
  if (!repo) return;

  const status = prompt('상태(active/candidate/excluded)', repo.status);
  if (status === null) return;
  const track = prompt('트랙(frontend/backend/android)', repo.track);
  if (track === null) return;
  const type = prompt('타입(individual/integration)', repo.type);
  if (type === null) return;
  const description = prompt('설명', repo.description ?? '');
  if (description === null) return;
  const cohortsInput = prompt('기수 (쉼표로 구분, 예: 7,8)', repo.cohorts?.join(', ') ?? '');
  if (cohortsInput === null) return;
  const cohorts = cohortsInput ? cohortsInput.split(',').map((c) => Number(c.trim())).filter((n) => !isNaN(n)) : null;
  const levelInput = prompt('레벨 (1/2/3/4, 없으면 빈칸)', repo.level != null ? String(repo.level) : '');
  if (levelInput === null) return;
  const level = levelInput.trim() ? Number(levelInput.trim()) : null;
  const nicknameRegex = prompt('기본 닉네임 정규식', repo.nicknameRegex ?? '');
  if (nicknameRegex === null) return;
  const cohortRegexRules = prompt(
    '기수별 정규식 JSON',
    repo.cohortRegexRules?.length ? JSON.stringify(repo.cohortRegexRules) : '',
  );
  if (cohortRegexRules === null) return;

  fetch(`/admin/repos/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({
      status,
      track,
      type,
      description: description || null,
      cohorts,
      level,
      nicknameRegex: nicknameRegex || null,
      cohortRegexRules: parseJsonOrNull(cohortRegexRules),
    }),
  })
    .then(() => {
      toast('레포 수정 완료');
      return loadRepos();
    })
    .catch(() => alert('레포 수정에 실패했습니다.'));
}

function deleteAllRepos() {
  if (!confirm('모든 레포와 관련 submission을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/repos', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 레포 삭제 완료');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

function deleteRepo(id) {
  if (!confirm('레포와 관련 submission을 함께 삭제합니다. 계속할까요?')) return;

  fetch(`/admin/repos/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('레포 삭제 완료');
      return Promise.all([loadRepos(), loadStatus()]);
    })
    .catch(() => alert('레포 삭제에 실패했습니다.'));
}


function syncRepo(id, button) {
  button.disabled = true;
  button.textContent = '...';
  fetch(`/admin/repos/${id}/sync`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      toast(`${data.synced}건 수집됨`);
      document.getElementById('sync-result').textContent = `${data.synced}건 수집 완료`;
      return Promise.all([loadStatus(), loadMembers()]);
    })
    .catch(() => toast('단건 sync 실패'))
    .finally(() => {
      button.disabled = false;
      button.textContent = 'Sync';
    });
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
  fetch(`/admin/repos/${repo.id}/sync`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('sync-result').textContent = `ts-and-learning ${data.synced}건 수집`;
      toast(`ts-and-learning 테스트 완료 (${data.synced}건)`);
      return Promise.all([loadStatus(), loadMembers()]);
    })
    .catch(() => toast('ts-and-learning 테스트 실패'))
    .finally(() => {
      button.disabled = false;
      button.textContent = 'ts-and-learning 테스트';
    });
}

function triggerBlogSync() {
  const button = document.getElementById('blog-sync-btn');
  button.disabled = true;
  button.textContent = '동기화 중...';
  fetch('/admin/blog/sync', { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      toast(`블로그 ${data.synced}건 수집, ${data.deleted}건 삭제`);
      return loadMembers();
    })
    .catch(() => toast('블로그 sync 실패'))
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
  fetch(`/admin/blog/backfill?limit=30${cohortParam}`, { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      const failureText = data.failures.length > 0
        ? ` / 실패 예시: ${data.failures.map((item) => `${item.githubId}(${item.reason})`).join(', ')}`
        : '';
      document.getElementById('sync-result').textContent =
        `블로그 링크 확인 ${data.checked}명, 저장 ${data.updated}명, 비어 있음 ${data.missing}명, 실패 ${data.failed}명${failureText}`;
      toast(`블로그 링크 백필 완료 (${data.updated}명 저장)`);
      return loadMembers();
    })
    .catch(() => toast('블로그 링크 백필 실패'))
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
    tbody.innerHTML = `<tr><td colspan="9" class="muted">조건에 맞는 멤버가 없습니다.</td></tr>`;
    summary.textContent = '총 0명';
    return;
  }

  tbody.innerHTML = memberList.map((member) => `
    <tr>
      <td>
        <div class="stack">
          <strong>${escapeHtml(member.githubId)}</strong>
          <a class="link" href="https://github.com/${member.githubId}" target="_blank">GitHub</a>
        </div>
      </td>
      <td>
        <div class="stack">
          <strong>${escapeHtml(member.nickname ?? '-')}</strong>
          <span class="muted">manual: ${escapeHtml(member.manualNickname ?? '-')}</span>
        </div>
      </td>
      <td>${(member.roles?.length ? member.roles : ['crew']).map((r) => `<span class="pill ${r}">${roleLabel(r)}</span>`).join(' ')}</td>
      <td>${member.cohort ? `<span class="pill cohort">${member.cohort}기</span>` : '-'}</td>
      <td>
        ${member.tracks.length > 0 ? `
          <div class="track-list">
            ${member.tracks.map((track) => `<span class="track-badge ${track}">${track == null ? '공통' : track}</span>`).join('')}
          </div>
        ` : '-'}
      </td>
      <td>
        <details>
          <summary>${member._count.submissions}건 보기</summary>
          ${member.submissions.length > 0 ? `
            <div class="pr-list">
              ${member.submissions.map((submission) => `
                <div class="post-item">
                  <a href="${submission.prUrl}" target="_blank">${escapeHtml(submission.title)}</a>
                  <div class="muted">${escapeHtml(submission.missionRepo.name)} · ${escapeHtml(submission.missionRepo.track == null ? '공통' : submission.missionRepo.track)}</div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="muted" style="margin-top:8px">제출 내역이 없습니다.</div>'}
        </details>
      </td>
      <td>
        ${member.blog
          ? `<a class="link" href="${member.blog}" target="_blank" onclick="event.stopPropagation()">${member.blog}</a>
             ${member.blogPostsLatest?.length > 0 ? `<button class="btn-sm btn-ghost" style="margin-top:4px" onclick="openBlogModal(${member.id}, '${escapeHtml(member.nickname ?? member.githubId)}')">글 보기</button>` : ''}`
          : '-'}
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
          <button class="btn-sm btn-ghost" onclick="editMemberRoles(${member.id})">역할</button>
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

function deleteAllMembers() {
  if (!confirm('모든 멤버와 관련 submission, 블로그 글을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/members', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 멤버 삭제 완료');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

function deleteMember(id) {
  if (!confirm('멤버와 관련 submission/blog 데이터를 함께 삭제합니다. 계속할까요?')) return;

  fetch(`/admin/members/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('멤버 삭제 완료');
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
    .then(() => toast('Workspace 저장 완료'))
    .catch(() => toast('Workspace 저장 실패'));
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
  try {
    const res = await fetch('/admin/repos/detect-regex-all', { method: 'POST', headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const results = await res.json();
    const applied = results.filter((r) => !r.skipped);
    const skipped = results.filter((r) => r.skipped);
    toast(`정규식 적용 완료: ${applied.length}개 / 스킵 ${skipped.length}개`);
    await loadRepos();
  } catch (e) {
    alert(`정규식 자동감지 실패: ${e}`);
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
  if (!cohortRepoList.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted" style="text-align:center;padding:16px">추가된 레포 없음</td></tr>`;
    return;
  }
  tbody.innerHTML = cohortRepoList.map((entry) => `
    <tr>
      <td class="muted small">${entry.order}</td>
      <td><strong>${escapeHtml(entry.missionRepo.name)}</strong></td>
      <td class="muted small">${entry.missionRepo.track ?? '공통'}</td>
      <td class="muted small">${entry.missionRepo.level != null ? `레벨${entry.missionRepo.level}` : '-'}</td>
      <td>
        <div class="actions">
          <input type="number" class="order-input" value="${entry.order}" onchange="setCohortRepoOrder(${entry.id}, this.value)" title="순서" style="width:52px" />
          <button class="btn-sm btn-danger" onclick="deleteCohortRepo(${entry.id})">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function addCohortRepo() {
  const cohort = cohortRepoSelectedCohort;
  if (!cohort) { alert('기수를 먼저 선택하세요.'); return; }
  const select = document.getElementById('cohort-repo-select');
  const missionRepoId = Number(select.value);
  if (!missionRepoId) { alert('레포를 선택하세요.'); return; }
  const order = Number(document.getElementById('cohort-repo-order').value) || 0;

  fetch('/admin/cohort-repos', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ cohort, missionRepoId, order }),
  })
    .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then(() => { toast('레포 추가됨'); loadCohortRepos(); })
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

function autoFillCohortRepos() {
  const cohort = cohortRepoSelectedCohort ?? Number(document.getElementById('cohort-repo-cohort').value);
  if (!cohort) { alert('기수를 먼저 선택하세요.'); return; }
  fetch('/admin/cohort-repos/auto-fill', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ cohort }),
  })
    .then((r) => r.json())
    .then((data) => { toast(`${data.added}개 레포 자동 추가됨`); loadCohortRepos(); })
    .catch(() => alert('자동 채우기 실패'));
}

function populateCohortRepoSelect() {
  const select = document.getElementById('cohort-repo-select');
  select.innerHTML = '<option value="">레포 선택</option>' +
    repoList
      .map((r) => `<option value="${r.id}">[${r.status}] ${escapeHtml(r.name)}${r.level != null ? ` (레벨${r.level})` : ''}</option>`)
      .join('');
}
