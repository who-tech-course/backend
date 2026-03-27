import { describe, expect, it } from '@jest/globals';
import { discoverMissionRepos } from '../../features/repo/repo-discovery.service.js';

describe('discoverMissionRepos', () => {
  it('미션 레포 후보를 추려낸다', () => {
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

    expect(repos).toHaveLength(1);
    expect(repos[0]?.name).toBe('ts-and-learning');
    expect(repos[0]?.track).toBe('frontend');
  });
});
