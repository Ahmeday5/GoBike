import { decodeJwt, getJwtExpiry, isJwtExpired } from './jwt.util';

function makeJwt(payload: object): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

describe('jwt.util', () => {
  it('decodes the payload of a well-formed token', () => {
    const token = makeJwt({ sub: '42', name: 'Ali' });
    expect(decodeJwt(token)).toEqual({ sub: '42', name: 'Ali' });
  });

  it('returns null for malformed tokens', () => {
    expect(decodeJwt('not-a-jwt')).toBeNull();
    expect(decodeJwt('a.%%%.c')).toBeNull();
  });

  it('reads `exp` as a millisecond epoch', () => {
    expect(getJwtExpiry(makeJwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
    expect(getJwtExpiry(makeJwt({}))).toBeNull();
  });

  it('treats tokens within the buffer (or without exp) as expired', () => {
    const inOneMinute = Math.floor(Date.now() / 1000) + 60;
    const token = makeJwt({ exp: inOneMinute });

    expect(isJwtExpired(token)).toBe(false);
    expect(isJwtExpired(token, 120_000)).toBe(true);
    expect(isJwtExpired(makeJwt({}))).toBe(true);
  });
});
