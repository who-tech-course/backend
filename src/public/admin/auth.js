import { loadInitialAdminData } from './bootstrap.js';
import { adminState } from './state.js';
import { authHeaders } from './http.js';

export function login() {
  adminState.token = document.getElementById('secret-input').value;
  fetch('/admin/status', { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error('unauthorized');
      localStorage.setItem('admin_token', adminState.token);
      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
      return loadInitialAdminData();
    })
    .catch(() => alert('잘못된 비밀키입니다.'));
}

export function tryAutoLogin() {
  if (!adminState.token) return;
  fetch('/admin/status', { headers: authHeaders() })
    .then((response) => {
      if (!response.ok) {
        localStorage.removeItem('admin_token');
        adminState.token = '';
        return;
      }
      document.getElementById('login').style.display = 'none';
      document.getElementById('main').style.display = 'block';
      return loadInitialAdminData();
    })
    .catch(() => {
      localStorage.removeItem('admin_token');
      adminState.token = '';
    });
}
