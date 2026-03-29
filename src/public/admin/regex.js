import { addLog } from './logs.js';
import { adminState } from './state.js';
import { authHeaders } from './http.js';
import { escapeHtml, toast } from './utils.js';
import { loadRepos } from './repos.js';

export function detectRepoRegex(id) {
  adminState.regexModalRepoId = id;
  adminState.regexModalResult = null;
  adminState.regexModalMode = 'detect';

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
      adminState.regexModalResult = result;
      renderRegexModal(result);
      applyBtn.disabled = false;
    })
    .catch(() => {
      body.innerHTML = '<div class="sub">정규식 감지에 실패했습니다.</div>';
    });
}

export function renderRegexModal(result) {
  const body = document.getElementById('regex-modal-body');
  const { samples, suggestion } = result;

  const samplesHtml = samples
    .map((sample) => {
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
    })
    .join('');

  const suggestionRegex = suggestion.nicknameRegex ?? '';
  const suggestionHtml = `
    <div style="margin-bottom:16px;">
      <div class="sub" style="margin-bottom:8px;">전 기수 동일 정규식 (비워두면 기수별로 적용)</div>
      <input type="text" id="suggestion-regex-input" value="${escapeHtml(suggestionRegex)}" placeholder="기수별 정규식이 다르면 비워두세요" />
    </div>
  `;

  body.innerHTML = suggestionHtml + samplesHtml;
}

export function closeRegexModal() {
  document.getElementById('regex-modal').style.display = 'none';
  adminState.regexModalRepoId = null;
  adminState.regexModalResult = null;
}

export async function detectRegexAll() {
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

export function closeValidateModal() {
  document.getElementById('validate-regex-modal').style.display = 'none';
}

export async function startValidateAllRegex() {
  const modal = document.getElementById('validate-regex-modal');
  const progress = document.getElementById('validate-regex-progress');
  const body = document.getElementById('validate-regex-body');
  const btn = document.getElementById('validate-regex-btn');

  modal.style.display = 'flex';
  body.innerHTML = '';
  btn.disabled = true;

  const activeRepos = adminState.repoList.filter((r) => r.status === 'active');
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

  body.innerHTML = issues
    .map((result) => renderValidateIssue(result))
    .join('<hr style="margin:8px 0;border-color:#e2e8f0">');
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

export function dismissValidateIssue(id) {
  const el = document.getElementById(`validate-issue-${id}`);
  if (el) el.closest('div[style]').style.display = 'none';
}

export function applyDetectedRegex() {
  if (!adminState.regexModalRepoId) return;

  let payload;

  if (adminState.regexModalMode === 'edit') {
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
    if (!adminState.regexModalResult) return;
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

  fetch(`/admin/repos/${adminState.regexModalRepoId}`, {
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
