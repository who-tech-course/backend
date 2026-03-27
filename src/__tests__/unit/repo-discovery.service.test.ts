import { describe, expect, it } from '@jest/globals';
import { discoverMissionRepos } from '../../features/repo/repo-discovery.service.js';

describe('discoverMissionRepos', () => {
  it('조직 레포를 candidate/excluded로 분류한다', () => {
    const repos = discoverMissionRepos([
      {
        id: 1,
        name: 'ts-and-learning',
        html_url: 'https://github.com/woowacourse/ts-and-learning',
        description: 'TypeScript 학습 미션',
        language: null,
        archived: false,
        private: false,
      },
      {
        id: 2,
        name: 'woowacourse-docs',
        html_url: 'https://github.com/woowacourse/woowacourse-docs',
        description: '문서 저장소',
        language: null,
        archived: false,
        private: false,
      },
    ]);

    expect(repos).toHaveLength(2);
    expect(repos[0]?.name).toBe('ts-and-learning');
    expect(repos[0]?.track).toBe('frontend');
    expect(repos[0]?.status).toBe('candidate');
    expect(repos[1]?.name).toBe('woowacourse-docs');
    expect(repos[1]?.status).toBe('excluded');
  });
});
