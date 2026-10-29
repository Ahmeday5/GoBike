import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

/** Unsigned JWT whose `exp` is `secondsFromNow` away — enough for `getJwtExpiry`. */
function jwt(secondsFromNow: number): string {
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
  return `h.${payload.replace(/=+$/, '')}.s`;
}

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let accessToken: string | null;
  let loggedIn: boolean;
  const fresh = jwt(3600);
  const auth = {
    getAccessToken: () => accessToken,
    isLoggedIn: () => loggedIn,
    refreshToken: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(() => {
    accessToken = null;
    loggedIn = true;
    auth.refreshToken.mockReset().mockReturnValue(of({ accessToken: fresh }));
    auth.logout.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('mints an access token first when a signed-in tab has none in memory', () => {
    http.get('/x').subscribe();

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(backend.expectOne('/x').request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
  });

  it('sends anonymous requests untouched when signed out', () => {
    loggedIn = false;
    http.get('/x').subscribe();

    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect(backend.expectOne('/x').request.headers.has('Authorization')).toBe(false);
  });

  it('refreshes before sending when the token is about to expire', () => {
    accessToken = jwt(5);
    http.get('/x').subscribe();

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(backend.expectOne('/x').request.headers.get('Authorization')).toBe(`Bearer ${fresh}`);
  });

  it('refreshes and retries once on a 401 marked Token-Expired', () => {
    accessToken = jwt(3600);
    let body: unknown;
    http.get('/x').subscribe((b) => (body = b));

    backend
      .expectOne('/x')
      .flush(null, { status: 401, statusText: 'U', headers: { 'Token-Expired': 'true' } });
    backend.expectOne('/x').flush({ ok: true });

    expect(auth.refreshToken).toHaveBeenCalledTimes(1);
    expect(body).toEqual({ ok: true });
  });

  it('signs out on any other 401', () => {
    accessToken = jwt(3600);
    http.get('/x').subscribe({ error: () => undefined });

    backend.expectOne('/x').flush(null, { status: 401, statusText: 'U' });

    expect(auth.refreshToken).not.toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalled();
  });
});
