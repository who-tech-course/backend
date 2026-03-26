import { describe, it, expect } from '@jest/globals';
import { SYNC_CRON_EXPRESSION } from '../../jobs/sync.job.js';

describe('syncJob', () => {
  it('매일 오전 3시 크론 표현식이다', () => {
    expect(SYNC_CRON_EXPRESSION).toBe('0 3 * * *');
  });
});
