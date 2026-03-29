import { addLog } from './logs.js';
import { adminState } from './state.js';
import { authHeaders, parseErrorResponse } from './http.js';
import { escapeHtml, roleLabel, toast } from './utils.js';
import { loadStatus } from './workspace.js';

export function loadMembers() {
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
    .then(async (response) => {
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const msg = body?.message ?? response.statusText ?? '멤버 목록 요청 실패';
        throw new Error(msg);
      }
      return body;
    })
    .then((members) => {
      if (!Array.isArray(members)) {
        console.error('GET /admin/members: expected array', members);
        adminState.memberList = [];
        renderMembers();
        toast('멤버 목록 형식이 올바르지 않습니다.');
        return;
      }
      adminState.memberList = members;
      renderMembers();
    })
    .catch((err) => {
      console.error(err);
      adminState.memberList = [];
      renderMembers();
      toast(err?.message ? `멤버 목록: ${err.message}` : '멤버 목록을 불러오지 못했습니다.');
    });
}

export function debouncedLoadMembers() {
  clearTimeout(adminState.memberSearchTimer);
  adminState.memberSearchTimer = setTimeout(loadMembers, 180);
}

export function renderMembers() {
  const tbody = document.getElementById('member-table-body');
  const summary = document.getElementById('member-summary');

  if (adminState.memberList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="muted">조건에 맞는 멤버가 없습니다.</td></tr>`;
    summary.textContent = '총 0명';
    return;
  }

  tbody.innerHTML = adminState.memberList
    .map(
      (member) => `
    <tr>
      <td>
        <div class="stack inline">
          <a href="https://github.com/${member.githubId}" target="_blank" style="display:block">
            ${
              member.avatarUrl
                ? `<img class="avatar" src="${member.avatarUrl}" alt="${escapeHtml(member.githubId)} avatar" />`
                : `<span class="avatar-fallback">${escapeHtml((member.githubId ?? '?').slice(0, 2).toUpperCase())}</span>`
            }
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
      <td>
        <div class="stack">
          ${(member.cohorts || []).map((c) => `<span class="pill cohort">${c.cohort}기</span>`).join('') || '-'}
        </div>
      </td>
      <td>
        ${
          (member.tracks ?? []).length > 0
            ? `
          <div class="track-list">
            ${(member.tracks ?? [])
              .map((track) => `<span class="track-badge ${track}">${track == null ? '공통' : track}</span>`)
              .join('')}
          </div>
        `
            : '-'
        }
      </td>
      <td>
        ${
          (member._count?.submissions ?? 0) > 0
            ? `<button class="btn-sm btn-ghost" onclick="openSubmissionModal(${member.id}, '${escapeHtml(member.nickname ?? member.githubId)}')">${member._count.submissions}건 보기</button>`
            : '<span class="muted">0건</span>'
        }
      </td>
      <td>
        ${
          member.blog
            ? `<a class="link" href="${member.blog}" target="_blank" onclick="event.stopPropagation()">${member.blog}</a>
             ${member.blogPostsLatest?.length > 0 ? `<button class="btn-sm btn-ghost" style="margin-top:4px" onclick="openBlogModal(${member.id}, '${escapeHtml(member.nickname ?? member.githubId)}')">글 보기</button>` : ''}`
            : '-'
        }
      </td>
      <td>
        ${renderRssStatus(member)}
      </td>
      <td>
        ${
          (member.blogPostsLatest ?? []).length > 0
            ? `
          <div class="post-list">
            ${member.blogPostsLatest
              .map(
                (post) => `
              <div class="post-item">
                <a href="${post.url}" target="_blank">${escapeHtml(post.title)}</a>
                <div class="muted">${new Date(post.publishedAt).toLocaleDateString('ko-KR')}</div>
              </div>
            `,
              )
              .join('')}
          </div>
        `
            : '-'
        }
      </td>
      <td>
        <div class="actions">
          <button class="btn-sm btn-ghost" onclick="refreshMemberProfile(${member.id}, '${escapeHtml(member.githubId)}')">프로필</button>
          <button class="btn-sm btn-ghost" onclick="editMember(${member.id})">수정</button>
          <button class="btn-sm btn-danger" onclick="deleteMember(${member.id})">삭제</button>
        </div>
      </td>
    </tr>
  `,
    )
    .join('');

  const cohortCounts = {};
  for (const m of adminState.memberList) {
    const cohorts = m.cohorts?.length ? m.cohorts.map((c) => c.cohort) : [null];
    for (const c of cohorts) {
      const key = c ? `${c}기` : '기수 미상';
      cohortCounts[key] = (cohortCounts[key] ?? 0) + 1;
    }
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
  summary.textContent = `총 ${adminState.memberList.length}명` + (cohortSummary ? `  |  ${cohortSummary}` : '');
}

function renderMemberRoleButtons(member) {
  const roles = (member.roles ?? []).length ? member.roles : ['crew'];
  return `
    <div class="role-toggle-group">
      ${['crew', 'coach', 'reviewer']
        .map(
          (role) => `
        <button
          class="btn-sm role-toggle ${roles.includes(role) ? `active ${role}` : ''}"
          onclick="toggleMemberRole(${member.id}, '${role}')"
        >${roleLabel(role)}</button>
      `,
        )
        .join('')}
    </div>
  `;
}

function renderRssStatus(member) {
  if (!member.blog) {
    return '<span class="muted">블로그 없음</span>';
  }

  const label =
    member.rssStatus === 'available'
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
  ]
    .filter(Boolean)
    .join('');

  return `<div class="stack"><span class="pill rss ${member.rssStatus ?? 'unknown'}">${label}</span>${extra}</div>`;
}

export function addMember() {
  const githubId = document.getElementById('new-member-github').value.trim();
  if (!githubId) {
    alert('GitHub ID를 입력하세요.');
    return;
  }

  const nickname = document.getElementById('new-member-nickname').value.trim() || null;
  const cohortVal = document.getElementById('new-member-cohort').value.trim();
  const cohort = cohortVal ? Number(cohortVal) : null;
  const roles = ['crew', 'coach', 'reviewer'].filter((r) => document.getElementById(`new-member-role-${r}`).checked);
  if (roles.length === 0) roles.push('crew');
  const blog = document.getElementById('new-member-blog').value.trim() || null;

  fetch('/admin/members', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ githubId, nickname, cohort, roles, blog }),
  })
    .then((res) => {
      if (!res.ok) throw new Error('failed');
      ['new-member-github', 'new-member-nickname', 'new-member-cohort', 'new-member-blog'].forEach((id) => {
        document.getElementById(id).value = '';
      });
      toast('멤버 추가 완료');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('멤버 추가에 실패했습니다.'));
}

export function refreshMemberProfiles() {
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
      addLog(
        `프로필 갱신 완료 — 확인 ${result.checked}명, 갱신 ${result.refreshed}명, 실패 ${result.failed}명`,
        result.failed ? 'err' : 'ok',
      );
      return loadMembers();
    })
    .catch((err) => {
      const detail = err?.message ?? String(err);
      toast('프로필 갱신 실패');
      addLog(`프로필 갱신 실패: ${detail}`, 'err');
    });
}

export function refreshMemberProfile(id, githubId) {
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

export function editMember(id) {
  const member = adminState.memberList.find((item) => item.id === id);
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

export function editMemberRoles(id) {
  const member = adminState.memberList.find((item) => item.id === id);
  if (!member) return;

  const current = (member.roles ?? ['crew']).join(', ');
  const rolesInput = prompt('역할 (crew / coach / reviewer, 쉼표로 구분)', current);
  if (rolesInput === null) return;
  const roles = rolesInput
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

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

export function toggleMemberRole(id, role) {
  const member = adminState.memberList.find((item) => item.id === id);
  if (!member) return;

  const cohort = member.cohort;
  if (!cohort) {
    alert('기수 정보가 없는 멤버는 역할을 수정할 수 없습니다.');
    return;
  }

  const currentRoles = member.roles?.length ? [...member.roles] : ['crew'];
  let nextRoles = currentRoles.includes(role) ? currentRoles.filter((item) => item !== role) : [...currentRoles, role];

  if (nextRoles.length === 0) {
    nextRoles = ['crew'];
  }

  fetch(`/admin/members/${id}`, {
    method: 'PATCH',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ roles: nextRoles, cohort }),
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

export function openBlogModal(memberId, name) {
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
          : posts
              .map(
                (p) => `
            <div class="post-item" style="padding:8px 0;border-bottom:1px solid #f1f5f9">
              <a class="link" href="${p.url}" target="_blank">${escapeHtml(p.title)}</a>
              <div class="muted">${new Date(p.publishedAt).toLocaleDateString('ko-KR')}</div>
            </div>
          `,
              )
              .join('');

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

export function closeBlogModal() {
  document.getElementById('blog-modal').style.display = 'none';
}

export function openSubmissionModal(memberId, name) {
  const modal = document.getElementById('submission-modal');
  const title = document.getElementById('submission-modal-title');
  const body = document.getElementById('submission-modal-body');
  const member = adminState.memberList.find((item) => item.id === memberId);

  title.textContent = `${name} 제출 내역`;

  if (!member || !(member.submissions ?? []).length) {
    body.innerHTML = '<div class="sub" style="padding:16px">제출 내역이 없습니다.</div>';
    modal.style.display = 'flex';
    return;
  }

  body.innerHTML = `
    <div style="padding:16px">
      <div class="pr-list" style="min-width:0">
        ${member.submissions
          .map(
            (submission) => `
          <div class="post-item" style="padding:10px 0;border-bottom:1px solid #f1f5f9">
            <a href="${submission.prUrl}" target="_blank">${escapeHtml(submission.title)}</a>
            <div class="muted">${escapeHtml(submission.missionRepo.name)} · ${escapeHtml(submission.missionRepo.track == null ? '공통' : submission.missionRepo.track)}</div>
            <div class="muted">#${submission.prNumber} · ${new Date(submission.submittedAt).toLocaleDateString('ko-KR')}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    </div>
  `;
  modal.style.display = 'flex';
}

export function closeSubmissionModal() {
  document.getElementById('submission-modal').style.display = 'none';
}

export function deleteAllMembers() {
  if (!confirm('모든 멤버와 관련 submission, 블로그 글을 삭제합니다. 계속할까요?')) return;

  fetch('/admin/members', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('전체 멤버 삭제 완료');
      addLog('전체 멤버 삭제 완료', 'ok');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('전체 삭제에 실패했습니다.'));
}

export function deleteMember(id) {
  if (!confirm('멤버와 관련 submission/blog 데이터를 함께 삭제합니다. 계속할까요?')) return;
  const member = adminState.memberList.find((m) => m.id === id);

  fetch(`/admin/members/${id}`, { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      toast('멤버 삭제 완료');
      addLog(`멤버 삭제 — ${member?.githubId ?? `#${id}`}`, 'ok');
      return Promise.all([loadMembers(), loadStatus()]);
    })
    .catch(() => alert('멤버 삭제에 실패했습니다.'));
}
