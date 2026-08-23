import { fakeAsync, tick, TestBed } from '@angular/core/testing';
import { HttpLoadingReporter, APPEAR_AFTER_MS, MIN_VISIBLE_MS } from './http-loading.reporter';
import { ProgressReporterRegistry } from './progress-reporter-registry.service';

describe('HttpLoadingReporter', () => {
  let reporter: HttpLoadingReporter;
  let registry: ProgressReporterRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(ProgressReporterRegistry);
    reporter = TestBed.inject(HttpLoadingReporter);
  });

  it('registers itself so the toast can render it', () => {
    expect(registry.get('http-loading')).toBe(reporter);
  });

  it('shows nothing for a request that finishes inside the delay window', fakeAsync(() => {
    reporter.begin();
    tick(200);
    reporter.end();
    tick(1000);

    expect(reporter.isActive).withContext('a 200ms request must stay invisible').toBeFalse();
    expect(reporter.isVisible).toBeFalse();
  }));

  it('appears once a request outlives the delay', fakeAsync(() => {
    reporter.begin();
    tick(APPEAR_AFTER_MS);

    expect(reporter.isActive).toBeTrue();

    reporter.end();
    tick(MIN_VISIBLE_MS);
    expect(reporter.isActive).toBeFalse();
  }));

  it('holds the card for the minimum visible time', fakeAsync(() => {
    reporter.begin();
    tick(APPEAR_AFTER_MS);
    reporter.end();

    tick(MIN_VISIBLE_MS - 50);
    expect(reporter.isActive).withContext('must not flicker away instantly').toBeTrue();

    tick(50);
    expect(reporter.isActive).toBeFalse();
  }));

  it('stays visible until the last of several overlapping requests ends', fakeAsync(() => {
    reporter.begin();
    reporter.begin();
    tick(APPEAR_AFTER_MS);
    expect(reporter.isActive).toBeTrue();

    reporter.end();
    tick(MIN_VISIBLE_MS + 100);
    expect(reporter.isActive).withContext('one request is still in flight').toBeTrue();

    reporter.end();
    tick(MIN_VISIBLE_MS);
    expect(reporter.isActive).toBeFalse();
  }));

  it('cannot be driven negative by more ends than begins', fakeAsync(() => {
    reporter.end();
    reporter.end();
    reporter.begin();
    tick(APPEAR_AFTER_MS);

    expect(reporter.isActive).withContext('a stray end must not cancel the next request').toBeTrue();
    reporter.end();
    tick(MIN_VISIBLE_MS);
    expect(reporter.isActive).toBeFalse();
  }));
});
