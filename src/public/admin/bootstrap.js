import { loadActivityLogs } from './logs.js';
import { loadMembers } from './members.js';
import { loadRepos } from './repos.js';
import { loadStatus, loadWorkspace } from './workspace.js';

export function loadInitialAdminData() {
  return Promise.all([loadStatus(), loadWorkspace(), loadRepos(), loadMembers(), loadActivityLogs()]);
}
