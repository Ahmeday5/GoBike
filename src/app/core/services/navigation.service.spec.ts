import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NavigationService } from './navigation.service';
import { AuthService } from '../auth/services/auth.service';
import { PERMISSIONS } from '../auth/constants/permissions';

describe('NavigationService', () => {
  const permissions = signal<ReadonlySet<string>>(new Set());
  const user = signal<{ role: string } | null>({ role: 'Accountant' });

  beforeEach(() => {
    permissions.set(new Set());
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { permissionSet: permissions, currentUser: user } },
      ],
    });
  });

  const ids = () =>
    TestBed.inject(NavigationService)
      .visibleItems()
      .map((i) => i.id);

  it('hides every gated item from a user without permissions', () => {
    expect(ids()).toEqual([]);
  });

  it('shows exactly the items the permissions unlock, in menu order', () => {
    permissions.set(new Set([PERMISSIONS.Gps.Read, PERMISSIONS.Drivers.Read]));
    expect(ids()).toEqual(['map', 'drivers']);
  });

  it('treats multi-permission items as ANY-of', () => {
    permissions.set(new Set([PERMISSIONS.Incidents.Read]));
    expect(ids()).toContain('alerts');
  });

  it('reacts when permissions arrive after sign-in', () => {
    const nav = TestBed.inject(NavigationService);
    expect(nav.visibleItems()).toHaveLength(0);

    permissions.set(new Set([PERMISSIONS.Motorcycles.Read]));
    expect(nav.visibleItems().map((i) => i.id)).toEqual(['motorcycles']);
  });

  it('drops sections whose items are all hidden', () => {
    permissions.set(new Set([PERMISSIONS.Gps.Read]));
    const sections = TestBed.inject(NavigationService).visibleSections();
    expect(sections.map((s) => s.label)).toEqual(['المتابعة']);
  });
});
