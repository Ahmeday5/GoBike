import { Signal, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';

type Primitive = string | number | boolean;

export interface UrlState<T extends Record<string, Primitive>> {
  /** Current state: URL values parsed to the defaults' types, defaults for missing keys. */
  readonly state: Signal<T>;
  /**
   * Writes changes to the URL (replaceUrl — filters don't spam the history).
   * Changing anything other than the page resets `pageIndex` to its default,
   * so a new filter never lands on an empty page 7.
   */
  patch(changes: Partial<T>): void;
  /** Clears every key this state owns, leaving other query params untouched. */
  reset(): void;
}

/**
 * Screen state that lives in the query string — search, filters, page, sort,
 * active tab — so a refresh, back/forward or a shared link restores the view.
 *
 *   readonly filters = injectUrlState({ search: '', status: '', pageIndex: 1, pageSize: 20 });
 *   filters.state().status   // typed from the defaults
 *   filters.patch({ status: 'Available' })
 *
 * Types come from the defaults: number → parsed number, boolean → 'true'/'false',
 * string → as is. Values equal to their default are omitted from the URL.
 * Must be called in an injection context (field initializer / constructor).
 */
export function injectUrlState<T extends Record<string, Primitive>>(defaults: T): UrlState<T> {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const params = toSignal(route.queryParamMap, { requireSync: true });

  // Shallow equality: an unrelated query param changing (another state's tab,
  // say) must not hand downstream resources a "new" object and refetch.
  const state = computed(() => parse(params(), defaults), { equal: shallowEqual });

  const write = (next: T) => {
    const queryParams: Record<string, string | null> = {};
    for (const key of Object.keys(defaults)) {
      const value = next[key];
      queryParams[key] = value === defaults[key] || value === '' ? null : String(value);
    }
    void router.navigate([], {
      relativeTo: route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  };

  return {
    state,
    patch(changes) {
      const next = { ...state(), ...changes } as T;
      const pagingOnly = Object.keys(changes).every((k) => k === 'pageIndex');
      if ('pageIndex' in defaults && !pagingOnly && !('pageIndex' in changes)) {
        (next as Record<string, Primitive>)['pageIndex'] = defaults['pageIndex'];
      }
      write(next);
    },
    reset() {
      write({ ...defaults });
    },
  };
}

function shallowEqual(a: Record<string, Primitive>, b: Record<string, Primitive>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}

function parse<T extends Record<string, Primitive>>(params: ParamMap, defaults: T): T {
  const out: Record<string, Primitive> = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = params.get(key);
    if (raw === null || raw === '') {
      out[key] = fallback;
    } else if (typeof fallback === 'number') {
      const n = Number(raw);
      out[key] = Number.isFinite(n) ? n : fallback;
    } else if (typeof fallback === 'boolean') {
      out[key] = raw === 'true';
    } else {
      out[key] = raw;
    }
  }
  return out as T;
}
