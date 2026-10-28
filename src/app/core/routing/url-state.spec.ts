import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterTestingHarness } from '@angular/router/testing';
import { UrlState, injectUrlState } from './url-state';

const DEFAULTS = { search: '', status: '', onlyGps: false, pageIndex: 1, pageSize: 20 };

@Component({ standalone: true, template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class HostComponent {
  readonly filters: UrlState<typeof DEFAULTS> = injectUrlState(DEFAULTS);
}

describe('injectUrlState', () => {
  async function setup(url: string) {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'list', component: HostComponent }])],
    });
    const harness = await RouterTestingHarness.create();
    const host = await harness.navigateByUrl(url, HostComponent);
    return { harness, host, router: TestBed.inject(Router) };
  }

  it('parses query params into the defaults’ types', async () => {
    const { host } = await setup('/list?search=abc&pageIndex=3&onlyGps=true');
    expect(host.filters.state()).toEqual({
      search: 'abc',
      status: '',
      onlyGps: true,
      pageIndex: 3,
      pageSize: 20,
    });
  });

  it('falls back to defaults for missing or malformed values', async () => {
    const { host } = await setup('/list?pageIndex=abc');
    expect(host.filters.state().pageIndex).toBe(1);
  });

  it('writes only non-default values and resets the page on filter change', async () => {
    const { host, harness, router } = await setup('/list?pageIndex=4');
    host.filters.patch({ status: 'Available' });
    await harness.fixture.whenStable();

    expect(router.url).toBe('/list?status=Available');
    expect(host.filters.state().pageIndex).toBe(1);
  });

  it('keeps the filters when only the page changes', async () => {
    const { host, harness, router } = await setup('/list?status=Rented');
    host.filters.patch({ pageIndex: 2 });
    await harness.fixture.whenStable();

    expect(router.url).toBe('/list?status=Rented&pageIndex=2');
  });

  it('reset() clears its own keys and keeps unrelated params', async () => {
    const { host, harness, router } = await setup('/list?status=Rented&tab=docs');
    host.filters.reset();
    await harness.fixture.whenStable();

    expect(router.url).toBe('/list?tab=docs');
  });
});
