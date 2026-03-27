export interface CohortRule {
  year: number;
  cohort: number;
}

export interface CohortRegexRule {
  cohort: number;
  nicknameRegex: string;
}

export interface NicknameStat {
  nickname: string;
  count: number;
  lastSeenAt: string;
}

export interface ParsedSubmission {
  githubId: string;
  nickname: string;
  prNumber: number;
  prUrl: string;
  title: string;
  submittedAt: Date;
  cohort: number | null;
}
