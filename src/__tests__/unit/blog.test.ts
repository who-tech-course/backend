import { describe, expect, it } from '@jest/globals';
import { normalizeBlogUrl } from '../../shared/blog.js';

describe('normalizeBlogUrl', () => {
  it('프로토콜이 없으면 https를 붙인다', () => {
    expect(normalizeBlogUrl('iftype.github.io')).toBe('https://iftype.github.io');
  });

  it('끝 슬래시는 제거한다', () => {
    expect(normalizeBlogUrl('https://iftype.tistory.com/')).toBe('https://iftype.tistory.com');
  });

  it('유효하지 않으면 null을 반환한다', () => {
    expect(normalizeBlogUrl('not a url')).toBeNull();
  });
});
