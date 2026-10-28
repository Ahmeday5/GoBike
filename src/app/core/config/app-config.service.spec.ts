import { TestBed } from '@angular/core/testing';
import { AppConfigService } from './app-config.service';
import { environment } from '@env/environment';

describe('AppConfigService', () => {
  let service: AppConfigService;
  const originalFetch = global.fetch;

  beforeEach(() => {
    service = TestBed.inject(AppConfigService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetch(impl: () => Promise<Partial<Response>>) {
    global.fetch = jest.fn(impl) as unknown as typeof fetch;
  }

  it('starts from the build-time environment', () => {
    expect(service.apiUrl).toBe(environment.apiUrl);
  });

  it('applies overrides from config.json', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ apiUrl: 'https://prod/api' }) }));
    await service.load();
    expect(service.apiUrl).toBe('https://prod/api');
  });

  it('ignores empty values so `{ "apiUrl": "" }` keeps the default', async () => {
    mockFetch(async () => ({ ok: true, json: async () => ({ apiUrl: '' }) }));
    await service.load();
    expect(service.apiUrl).toBe(environment.apiUrl);
  });

  it('keeps defaults when config.json is missing or unreachable', async () => {
    mockFetch(async () => ({ ok: false }));
    await service.load();
    expect(service.apiUrl).toBe(environment.apiUrl);

    mockFetch(() => Promise.reject(new Error('offline')));
    await expect(service.load()).resolves.toBeUndefined();
    expect(service.apiUrl).toBe(environment.apiUrl);
  });
});
