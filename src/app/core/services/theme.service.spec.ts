import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let osDark: boolean;

  beforeEach(() => {
    osDark = false;
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: osDark,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      }),
    });
  });

  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    return service;
  }

  it('follows the OS by default', () => {
    osDark = true;
    const theme = create();

    expect(theme.preference()).toBe('system');
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });

  it('persists an explicit choice and applies it to <html>', () => {
    const theme = create();
    theme.setPreference('dark');
    TestBed.flushEffects();

    expect(localStorage.getItem('gobike_theme')).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(document.documentElement.dataset['bsTheme']).toBe('dark');
  });

  it('restores the saved preference', () => {
    localStorage.setItem('gobike_theme', 'light');
    osDark = true;
    expect(create().theme()).toBe('light');
  });

  it('toggle() flips between light and dark', () => {
    const theme = create();
    theme.toggle();
    expect(theme.theme()).toBe('dark');
    theme.toggle();
    expect(theme.theme()).toBe('light');
  });
});
