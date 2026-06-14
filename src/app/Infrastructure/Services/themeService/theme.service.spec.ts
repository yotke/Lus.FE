import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({ providers: [ThemeService] });
    service = TestBed.inject(ThemeService);
  });

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('setMode("dark") sets data-theme="dark" on <html> and persists it', () => {
    service.setMode('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(service.isDark).toBeTrue();
    expect(localStorage.getItem('app-theme-mode')).toBe('dark');
  });

  it('toggleDarkMode flips between light and dark', () => {
    service.setMode('light');
    expect(service.isDark).toBeFalse();
    service.toggleDarkMode();
    expect(service.isDark).toBeTrue();
    service.toggleDarkMode();
    expect(service.isDark).toBeFalse();
  });

  it('setColors writes the brand CSS custom property', () => {
    service.setColors({ primaryColor: '#112233' });
    const v = getComputedStyle(document.documentElement).getPropertyValue('--org-primary-color').trim();
    expect(v).toBe('#112233');
  });
});
