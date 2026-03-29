import { login, tryAutoLogin } from './auth.js';
import { triggerBlogBackfill, triggerBlogSync } from './blog.js';
import {
  addCohortRepo,
  autoFillCohortRepos,
  loadCohortRepos,
  renderCohortRepos,
  triggerCohortSync,
  deleteCohortRepo,
  setCohortRepoOrder,
} from './cohort-repos.js';
import { clearActivityLog, toggleActivityLog } from './logs.js';
import {
  addMember,
  closeBlogModal,
  closeSubmissionModal,
  debouncedLoadMembers,
  deleteMember,
  deleteAllMembers,
  editMember,
  openBlogModal,
  openSubmissionModal,
  refreshMemberProfile,
  refreshMemberProfiles,
  toggleMemberRole,
} from './members.js';
import {
  addRepo,
  changeCohortRepoLevel,
  deleteAllRepos,
  deleteRepo,
  discoverRepos,
  editRepoRegex,
  inlineEditCohorts,
  inlineEditDescription,
  inlineEditLevel,
  inlineEditStatus,
  inlineEditSyncMode,
  inlineEditTrack,
  inlineEditType,
  moveRepoCategory,
  populateCohortRepoSelect,
  setRepoContinuousPage,
  setRepoOncePage,
  setRepoTab,
} from './repos.js';
import {
  applyDetectedRegex,
  closeRegexModal,
  closeValidateModal,
  detectRegexAll,
  detectRepoRegex,
  dismissValidateIssue,
  startValidateAllRegex,
} from './regex.js';
import { resetSync, syncRepo, triggerSync, triggerTsAndLearningTest } from './sync.js';
import { saveWorkspace, toggleBlogSync } from './workspace.js';

Object.assign(window, {
  login,
  tryAutoLogin,
  triggerBlogBackfill,
  triggerBlogSync,
  toggleBlogSync,
  triggerSync,
  triggerTsAndLearningTest,
  deleteAllRepos,
  detectRegexAll,
  startValidateAllRegex,
  discoverRepos,
  setRepoTab,
  refreshMemberProfiles,
  deleteAllMembers,
  addMember,
  autoFillCohortRepos,
  triggerCohortSync,
  addCohortRepo,
  saveWorkspace,
  toggleActivityLog,
  clearActivityLog,
  closeBlogModal,
  closeSubmissionModal,
  closeRegexModal,
  applyDetectedRegex,
  closeValidateModal,
  loadCohortRepos,
  renderCohortRepos,
  moveRepoCategory,
  inlineEditStatus,
  inlineEditSyncMode,
  inlineEditTrack,
  inlineEditType,
  inlineEditLevel,
  inlineEditCohorts,
  inlineEditDescription,
  editRepoRegex,
  syncRepo,
  resetSync,
  detectRepoRegex,
  deleteRepo,
  addRepo,
  setRepoContinuousPage,
  setRepoOncePage,
  debouncedLoadMembers,
  toggleMemberRole,
  openBlogModal,
  openSubmissionModal,
  refreshMemberProfile,
  editMember,
  deleteMember,
  changeCohortRepoLevel,
  setCohortRepoOrder,
  deleteCohortRepo,
  dismissValidateIssue,
  populateCohortRepoSelect,
});

document.getElementById('secret-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    login();
  }
});

tryAutoLogin();
