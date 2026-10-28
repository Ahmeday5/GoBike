import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../auth/services/auth.service';
import { ToastService } from '../services/toast.service';
import { withSilentErrors } from '../http/http-context.tokens';
import { ApiError } from '../models/api-response.model';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let toastError: jest.Mock;
  let authenticated: boolean;

  beforeEach(() => {
    authenticated = true;
    toastError = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'groupCollapsed').mockImplementation(() => undefined);
    jest.spyOn(console, 'groupEnd').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: { error: toastError } },
        { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    jest.restoreAllMocks();
  });

  function fail(body: object | null, status: number, context?: HttpContext): ApiError {
    let error!: ApiError;
    http.get('/x', { context }).subscribe({ error: (e: ApiError) => (error = e) });
    backend.expectOne('/x').flush(body, { status, statusText: 'ERR' });
    return error;
  }

  it('normalizes the backend message and field errors into ApiError', () => {
    const error = fail({ message: 'Email taken', errors: { email: ['exists'] } }, 422);

    expect(error).toMatchObject({
      status: 422,
      message: 'Email taken',
      fieldErrors: { email: ['exists'] },
    });
    expect(toastError).toHaveBeenCalledWith('Email taken');
  });

  it('falls back to a status message when the body has none', () => {
    expect(fail(null, 503).message).toBe('الخدمة غير متاحة مؤقتًا');
  });

  it('does not toast when the caller opted out', () => {
    fail({ message: 'nope' }, 400, withSilentErrors());
    expect(toastError).not.toHaveBeenCalled();
  });

  it('does not toast for signed-out users', () => {
    authenticated = false;
    fail({ message: 'nope' }, 500);
    expect(toastError).not.toHaveBeenCalled();
  });
});
