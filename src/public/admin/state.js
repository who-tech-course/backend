/* eslint-disable @typescript-eslint/no-unused-vars */
export const REPO_PAGE_SIZE = 20;

export const adminState = {
  token: typeof localStorage !== 'undefined' ? (localStorage.getItem('admin_token') ?? '') : '',
  repoList: [],
  memberList: [],
  memberSearchTimer: null,
  repoTab: 'base',
  regexModalRepoId: null,
  regexModalResult: null,
  regexModalMode: 'detect',
  repoPageContinuous: 1,
  repoPageOnce: 1,
  blogSyncCountdownTimer: null,
  cohortRepoList: [],
  cohortRepoSelectedCohort: null,
};
