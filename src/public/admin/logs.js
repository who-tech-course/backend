import { authHeaders } from './http.js';
import { escapeHtml } from './utils.js';

export function renderLogEntry(ts, type, msg) {
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

export function addLog(msg, type = 'info') {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  renderLogEntry(ts, type, msg);
  fetch('/admin/logs', {
    method: 'POST',
    headers: authHeaders('application/json'),
    body: JSON.stringify({ type, message: msg }),
  }).catch(() => {});
}

export function loadActivityLogs() {
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

export function clearActivityLog() {
  fetch('/admin/logs', { method: 'DELETE', headers: authHeaders() })
    .then(() => {
      const body = document.getElementById('log-body');
      if (body) body.innerHTML = '';
    })
    .catch(() => {});
}

export function toggleActivityLog() {
  const body = document.getElementById('log-body');
  const btn = document.getElementById('log-toggle-btn');
  if (!body || !btn) return;
  const collapsed = body.classList.toggle('collapsed');
  btn.textContent = collapsed ? '펼치기 ▸' : '접기 ▾';
}
