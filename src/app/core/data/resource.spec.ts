import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { createResource } from './resource';

describe('createResource', () => {
  const inContext = <T>(fn: () => T): T => runInInjectionContext(TestBed.inject(Injector), fn);

  it('loads with the initial params and exposes the value', () => {
    const res = inContext(() =>
      createResource(
        () => 1,
        (n) => of(n * 10),
      ),
    );
    TestBed.flushEffects();

    expect(res.value()).toBe(10);
    expect(res.loading()).toBe(false);
    expect(res.error()).toBeNull();
  });

  it('cancels a stale request when params change (no out-of-order results)', () => {
    const responses: Record<number, Subject<string>> = { 1: new Subject(), 2: new Subject() };
    const params = signal(1);
    const res = inContext(() =>
      createResource(
        () => params(),
        (p) => responses[p],
      ),
    );
    TestBed.flushEffects();

    params.set(2);
    TestBed.flushEffects();
    responses[1].next('stale');
    responses[2].next('fresh');

    expect(res.value()).toBe('fresh');
  });

  it('keeps the previous value while reloading, then replaces it', () => {
    const pending = new Subject<string>();
    let first = true;
    const res = inContext(() =>
      createResource(
        () => 'q',
        () => (first ? ((first = false), of('v1')) : pending),
      ),
    );
    TestBed.flushEffects();
    expect(res.value()).toBe('v1');

    res.reload();
    TestBed.flushEffects();
    expect(res.loading()).toBe(true);
    expect(res.initialLoading()).toBe(false);
    expect(res.value()).toBe('v1');

    pending.next('v2');
    expect(res.value()).toBe('v2');
    expect(res.loading()).toBe(false);
  });

  it('captures errors instead of throwing, and recovers on the next success', () => {
    const params = signal(0);
    const res = inContext(() =>
      createResource(
        () => params(),
        (p) => (p === 0 ? throwError(() => ({ status: 500, message: 'boom' })) : of('ok')),
      ),
    );
    TestBed.flushEffects();
    expect(res.error()?.message).toBe('boom');

    params.set(1);
    TestBed.flushEffects();
    expect(res.error()).toBeNull();
    expect(res.value()).toBe('ok');
  });

  it('skips loading while params are null', () => {
    const loader = jest.fn(() => of('x'));
    inContext(() => createResource(() => null, loader));
    TestBed.flushEffects();
    expect(loader).not.toHaveBeenCalled();
  });

  it('re-runs on refetchOn emissions (e.g. realtime reconnect)', () => {
    const reconnected = new Subject<void>();
    const loader = jest.fn(() => of('x'));
    inContext(() => createResource(() => 'q', loader, { refetchOn: reconnected }));
    TestBed.flushEffects();

    reconnected.next();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
