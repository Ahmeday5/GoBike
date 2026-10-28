import { Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, map, merge, of, startWith, switchMap, tap } from 'rxjs';
import { ApiError } from '../models/api-response.model';

export interface Resource<T> {
  /** Last successfully loaded value — kept while a reload runs (no flicker). */
  readonly value: Signal<T | undefined>;
  /** True while a request is in flight. */
  readonly loading: Signal<boolean>;
  /** True only for the very first load (show skeletons, not a dimmed table). */
  readonly initialLoading: Signal<boolean>;
  readonly error: Signal<ApiError | null>;
  /** Re-runs the loader with the current params. */
  reload(): void;
  /** Optimistic/local update of the cached value. */
  update(fn: (value: T | undefined) => T | undefined): void;
}

export interface ResourceOptions {
  /** Extra triggers that re-run the loader (e.g. realtime reconnect). */
  refetchOn?: Observable<unknown>;
}

/**
 * Loads data reactively from signal-based params — the backbone of every
 * screen. Whenever `params()` changes the loader re-runs and any stale
 * in-flight request is cancelled (`switchMap`), so fast filtering never
 * renders out-of-order results. Return `null` from `params` to skip loading
 * (e.g. while an id is missing).
 *
 *   readonly motorcycles = createResource(
 *     () => this.filters.state(),
 *     (query) => this.api.list(query),
 *     { refetchOn: this.hub.reconnected$ },
 *   );
 *
 * Errors are captured into `error()` (callers decide how to show them);
 * pair the loader with `withSilentErrors()` when the screen renders the error itself.
 * Must be created in an injection context.
 */
export function createResource<P, T>(
  params: () => P | null,
  loader: (params: P) => Observable<T>,
  options: ResourceOptions = {},
): Resource<T> {
  const value = signal<T | undefined>(undefined);
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const loadedOnce = signal(false);
  const manual = signal(0);

  const request = computed(() => ({ params: params(), tick: manual() }));

  merge(toObservable(request), (options.refetchOn ?? EMPTY).pipe(map(() => request())))
    .pipe(
      switchMap(({ params: p }) => {
        if (p === null) {
          loading.set(false);
          return EMPTY;
        }
        return loader(p).pipe(
          map((v) => ({ ok: true as const, v })),
          catchError((e: ApiError) => of({ ok: false as const, e })),
          startWith(null),
        );
      }),
      tap((result) => {
        if (result === null) {
          loading.set(true);
          error.set(null);
          return;
        }
        loading.set(false);
        loadedOnce.set(true);
        if (result.ok) value.set(result.v);
        else error.set(result.e);
      }),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    value: value.asReadonly(),
    loading: loading.asReadonly(),
    initialLoading: computed(() => loading() && !loadedOnce()),
    error: error.asReadonly(),
    reload: () => manual.update((n) => n + 1),
    update: (fn) => value.update(fn),
  };
}
