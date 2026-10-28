import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { AppConfigService } from '../config/app-config.service';

describe('ApiService', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AppConfigService, useValue: { apiUrl: 'https://api.test/api/' } },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('joins the base URL and endpoint with exactly one slash', () => {
    api.get('/users').subscribe();
    http.expectOne('https://api.test/api/users').flush([]);
  });

  it('drops null/undefined/empty params and repeats array params', () => {
    api.get('users', { params: { page: 2, search: '', role: null, ids: [1, 2] } }).subscribe();

    const req = http.expectOne((r) => r.url === 'https://api.test/api/users');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('role')).toBe(false);
    expect(req.request.params.getAll('ids')).toEqual(['1', '2']);
    req.flush([]);
  });

  it('unwraps the `{ data }` envelope', () => {
    let result: unknown;
    api.get<{ id: number }>('users/1').subscribe((r) => (result = r));

    http.expectOne('https://api.test/api/users/1').flush({ success: true, data: { id: 1 } });
    expect(result).toEqual({ id: 1 });
  });

  it('passes raw (non-envelope) payloads through untouched', () => {
    let result: unknown;
    api.post<{ ok: boolean }>('things', { a: 1 }).subscribe((r) => (result = r));

    const req = http.expectOne('https://api.test/api/things');
    expect(req.request.body).toEqual({ a: 1 });
    req.flush({ ok: true });
    expect(result).toEqual({ ok: true });
  });
});
