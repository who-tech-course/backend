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

export type PrStatus = 'open' | 'closed' | 'merged';

export interface ParsedSubmission {
  githubUserId: number | null;
  githubId: string;
  nickname: string;
  prNumber: number;
  prUrl: string;
  title: string;
  submittedAt: Date;
  cohort: number | null;
  status: PrStatus;
}
