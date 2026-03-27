/* eslint-disable @typescript-eslint/no-unused-vars */
let token = '';
let repoList = [];
let memberList = [];
let memberSearchTimer = null;
let repoTab = 'base';

function login() {
  token = document.getElementById('secret-input').value;
  fetch('/admin/status', { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) {
        throw new Error('unauthorized');
      }

      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
      return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers()]);
    })
    .catch(() => alert('잘못된 비밀키입니다.'));
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
    });
}

function loadRepos() {
  return fetch('/admin/repos', { headers: authHeaders() })
    .then((response) => response.json())
    .then((repos) => {
      repoList = repos;
      renderRepos();
    });
}

function setRepoTab(tab) {
  repoTab = tab;
  document.getElementById('tab-base').classList.toggle('active', tab === 'base');
  document.getElementById('tab-common').classList.toggle('active', tab === 'common');
  const trackFilter = document.getElementById('repo-track-filter');
  trackFilter.style.display = tab === 'common' ? 'none' : '';
  renderRepos();
}

function renderRepos() {
  const search = document.getElementById('repo-search').value.trim().toLowerCase();
  const status = document.getElementById('repo-status-filter').value;
  const track = document.getElementById('repo-track-filter').value;

  const filtered = repoList.filter((repo) => {
    const isCommon = repo.track === null;
    if (repoTab === 'base' && isCommon) return false;
    if (repoTab === 'common' && !isCommon) return false;

    if (search && !repo.name.toLowerCase().includes(search)) {
      return false;
    }

    if (status && repo.status !== status) {
      return false;
    }

    if (track && repo.track !== track) {
      return false;
    }

    return true;
  });

  const tbody = document.getElementById('repo-table-body');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">조건에 맞는 레포가 없습니다.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((repo) => `
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
          <span class="muted">${repo.type}</span>
        </div>
      </td>
      <td>
        <div class="stack">
          <span>${escapeHtml(repo.description ?? '-')}</span>
          <span class="muted">${escapeHtml(repo.candidateReason ?? '-')}</span>
        </div>
      </td>
      <td class="mono">${escapeHtml(formatRepoRegex(repo))}</td>
      <td>
        <div class="actions">
          <button class="btn-sm btn-secondary" onclick="syncRepo(${repo.id}, this)">Sync</button>
          <button class="btn-sm btn-ghost" onclick="editRepo(${repo.id})">수정</button>
          <button class="btn-sm btn-danger" onclick="deleteRepo(${repo.id})">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');
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
  button.disabled = true;
  button.textContent = '동기화 중...';
  fetch('/admin/sync', { method: 'POST', headers: authHeaders() })
    .then((response) => response.json())
    .then((data) => {
      document.getElementById('sync-result').textContent =
        `완료: ${data.reposSynced}개 레포, ${data.totalSynced}건 수집됨`;
      toast(`전체 sync 완료 (${data.totalSynced}건)`);
      return Promise.all([loadStatus(), loadMembers()]);
    })
    .catch(() => {
      document.getElementById('sync-result').textContent = '전체 sync 실패';
    })
    .finally(() => {
      button.disabled = false;
      button.textContent = '전체 Sync';
    });
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
  fetch('/admin/blog/backfill?limit=30', { method: 'POST', headers: authHeaders() })
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
  const hasBlog = document.getElementById('member-blog-filter').value;
  const params = new URLSearchParams();

  if (q) params.set('q', q);
  if (cohort) params.set('cohort', cohort);
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
    tbody.innerHTML = `<tr><td colspan="8" class="muted">조건에 맞는 멤버가 없습니다.</td></tr>`;
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
      <td>${member.blog ? `<a class="link" href="${member.blog}" target="_blank">${member.blog}</a>` : '-'}</td>
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
          <button class="btn-sm btn-ghost" onclick="editMember(${member.id})">수정</button>
          <button class="btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>
        </div>
      </td>
    </tr>
  `).join('');

  summary.textContent = `총 ${memberList.length}명`;
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
      if (!response.ok) {
        throw new Error('failed');
      }
      toast('멤버 수정 완료');
      return loadMembers();
    })
    .catch(() => alert('멤버 수정에 실패했습니다.'));
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

document.getElementById('secret-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    login();
  }
});
