import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { GlobalErrorHandler } from './global-error-handler';
import { LoggerService } from '../services/logger.service';
import { ToastService } from '../services/toast.service';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let logError: jest.Mock;
  let toastError: jest.Mock;

  beforeEach(() => {
    logError = jest.fn();
    toastError = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        { provide: LoggerService, useValue: { error: logError } },
        { provide: ToastService, useValue: { error: toastError } },
      ],
    });
    handler = TestBed.inject(GlobalErrorHandler);
  });

  it('logs and toasts unexpected errors', () => {
    const err = new Error('boom');
    handler.handleError(err);

    expect(logError).toHaveBeenCalledWith('[Unhandled]', err);
    expect(toastError).toHaveBeenCalled();
  });

  it('unwraps promise rejections', () => {
    const err = new Error('async boom');
    handler.handleError({ rejection: err });
    expect(logError).toHaveBeenCalledWith('[Unhandled]', err);
  });

  it('does not double-toast HTTP errors (the interceptor already did)', () => {
    handler.handleError(new HttpErrorResponse({ status: 500 }));
    expect(logError).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });
});
