import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { DocumentBuilderSignalrService } from './document-builder-signalr.service';
import { DocumentBuilderReporter } from './document-builder.reporter';
import { SignalrGenericService } from '../SignalR/signalr-generic.service';
import { AgentStatusEvent } from './document-builder.events';

/** Stands in for the hub: one Subject per event name, driven by the test. */
class FakeHub {
  readonly channels = new Map<string, Subject<any>>();
  startConnection = jasmine.createSpy('startConnection').and.resolveTo('Connected');
  stopConnection = jasmine.createSpy('stopConnection').and.resolveTo(undefined);

  OnHubCall(name: string) {
    if (!this.channels.has(name)) this.channels.set(name, new Subject<any>());
    return this.channels.get(name)!.asObservable();
  }

  emit(name: string, payload: any) {
    this.channels.get(name)!.next(payload);
  }
}

describe('DocumentBuilderSignalrService', () => {
  let svc: DocumentBuilderSignalrService;
  let hub: FakeHub;
  let reporter: DocumentBuilderReporter;

  beforeEach(async () => {
    hub = new FakeHub();
    TestBed.configureTestingModule({
      providers: [{ provide: SignalrGenericService, useValue: hub }],
    });
    reporter = TestBed.inject(DocumentBuilderReporter);
    svc = TestBed.inject(DocumentBuilderSignalrService);
    await svc.connect();
  });

  const status = (Agent: string, State: AgentStatusEvent['State'], Detail?: string) =>
    hub.emit('AgentStatus', { Agent, State, Detail } as AgentStatusEvent);

  it('connects to the document builder hub', () => {
    expect(hub.startConnection).toHaveBeenCalledWith('hub/document-builder');
  });

  it('starts the reporter on the first agent event, without an explicit beginTurn', () => {
    expect(reporter.isActive).toBeFalse();
    status('doc.row_extractor', 'running');
    expect(reporter.isActive).toBeTrue();
  });

  it('narrates a known agent with its i18n key and catalog icon', () => {
    status('doc.row_extractor', 'running');

    expect(reporter.status.progress?.title).toBe('docBuilder.agents.rowExtractor.name');
    expect(reporter.status.progress?.icon).toBe('table_rows');
  });

  it('falls back to the raw name for an agent missing from the catalog', () => {
    status('doc.brand_new_agent', 'running');

    expect(reporter.status.progress?.title).toBe('doc.brand_new_agent');
    expect(reporter.status.progress?.icon).toBe('smart_toy');
  });

  it('advances the percentage across the enabled pipeline', () => {
    status('doc.schema_planner', 'running');
    const first = reporter.status.progress!.percentComplete;

    status('doc.validator', 'running');
    const later = reporter.status.progress!.percentComplete;

    expect(later).toBeGreaterThan(first);
    expect(later).toBeLessThanOrEqual(100);
  });

  it('completes on BuilderCommitCompleted and carries the counts', () => {
    status('doc.row_extractor', 'running');
    hub.emit('BuilderCommitCompleted', {
      JobId: 'j1', SessionId: 's1', OrganizationId: 0,
      Counts: { rows: 3 }, Warnings: [], Timestamp: new Date().toISOString(),
    });

    expect(reporter.isCompleted).toBeTrue();
    expect(reporter.status.progress?.percentComplete).toBe(100);
  });

  it('fails on BuilderError with the user-safe message', () => {
    status('doc.row_extractor', 'running');
    hub.emit('BuilderError', {
      JobId: 'j1', ErrorCode: 'AiError', Error: 'משהו השתבש',
      Timestamp: new Date().toISOString(),
    });

    expect(reporter.hasError).toBeTrue();
    expect(reporter.status.errorMessage).toBe('משהו השתבש');
  });

  it('fails when an agent reports failed', () => {
    status('doc.validator', 'failed', 'schema_validation_failed');
    expect(reporter.hasError).toBeTrue();
  });

  it('re-exposes draft patches for the canvas', (done) => {
    svc.draftPatched$.subscribe(e => {
      expect(e.Ops.length).toBe(1);
      done();
    });
    hub.emit('DraftPatched', {
      SessionId: 's1', Version: 2,
      Ops: [{ Op: 'UpdateRow', Path: 'rows[3].hours', Value: 4 }],
      Timestamp: new Date().toISOString(),
    });
  });
});
