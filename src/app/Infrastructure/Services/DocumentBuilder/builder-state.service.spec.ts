import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError, firstValueFrom } from 'rxjs';
import { BuilderStateService } from './builder-state.service';
import { DocumentBuilderApiService } from './document-builder-api.service';
import { DocumentBuilderSignalrService } from './document-builder-signalr.service';
import { DocumentBuilderTurnResponse } from './document-builder.types';

function session(version = 0) {
  return {
    Version: version,
    Draft: {
      Version: version,
      LastUtterance: '',
      Rows: [],
      Totals: { Hours: 0, CarryIn: 0, Remaining: 0, VatPercent: 18 },
      Template: null,
    },
  };
}

function turn(partial: Partial<DocumentBuilderTurnResponse>): DocumentBuilderTurnResponse {
  return { Version: 1, Ops: [], Messages: [], Warnings: [], ...partial };
}

describe('BuilderStateService', () => {
  let state: BuilderStateService;
  let api: jasmine.SpyObj<DocumentBuilderApiService>;
  let hub: {
    draftPatched$: Subject<any>;
    questionAsked$: Subject<any>;
    builderMessage$: Subject<any>;
    connect: jasmine.Spy;
    beginTurn: jasmine.Spy;
    endTurn: jasmine.Spy;
    failTurn: jasmine.Spy;
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<DocumentBuilderApiService>('DocumentBuilderApiService', [
      'session', 'turn', 'canvasEdit', 'uploadExemplar', 'undo', 'redo', 'agents',
    ]);
    api.session.and.returnValue(of(session(0)) as any);

    hub = {
      draftPatched$: new Subject<any>(),
      questionAsked$: new Subject<any>(),
      builderMessage$: new Subject<any>(),
      connect: jasmine.createSpy('connect').and.resolveTo(undefined),
      beginTurn: jasmine.createSpy('beginTurn'),
      endTurn: jasmine.createSpy('endTurn'),
      failTurn: jasmine.createSpy('failTurn'),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentBuilderApiService, useValue: api },
        { provide: DocumentBuilderSignalrService, useValue: hub },
      ],
    });
    state = TestBed.inject(BuilderStateService);
    await state.init();
  });

  it('loads the session draft on init', () => {
    expect(hub.connect).toHaveBeenCalled();
    expect(state.version).toBe(0);
  });

  it('applies a live SignalR patch to the canvas', () => {
    hub.draftPatched$.next({
      SessionId: 's', Version: 1, Timestamp: '',
      Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 3, Subject: 'מהסוכן' } }],
    });

    expect(state.draft.Rows.length).toBe(1);
    expect(state.version).toBe(1);
  });

  it('ignores a live patch for a version it already holds', () => {
    hub.draftPatched$.next({
      SessionId: 's', Version: 1, Timestamp: '',
      Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 3 } }],
    });
    // Same version arrives again (the HTTP response already applied it).
    hub.draftPatched$.next({
      SessionId: 's', Version: 1, Timestamp: '',
      Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 3 } }],
    });

    expect(state.draft.Rows.length).withContext('must not double-apply').toBe(1);
  });

  it('records the user message and the planner question from a turn', async () => {
    api.turn.and.returnValue(of(turn({
      Version: 1,
      Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 3 } }],
      Question: { Id: 'rate', Text: 'מה התעריף?', Chips: ['120'] },
    })) as any);

    await state.say('5 במרץ 3 שעות');

    const messages = await firstValueFrom(state.messages$);
    expect(messages[0].Role).toBe('user');
    const question = await firstValueFrom(state.question$);
    expect(question!.Id).toBe('rate');
    expect(state.draft.Rows.length).toBe(1);
  });

  it('clears the pending question when the user answers', async () => {
    api.turn.and.returnValue(of(turn({ Version: 1 })) as any);
    hub.questionAsked$.next({ Question: { Id: 'rate', Text: '?', Chips: [] } });
    expect(await firstValueFrom(state.question$)).toBeTruthy();

    await state.say('120');

    // The turn returned no new question, so the answered one must be gone.
    expect(await firstValueFrom(state.question$)).toBeNull();
  });

  // The loop the user hit: answer the rate question, get asked it again, forever.
  it('tells the server which question the message answers', async () => {
    hub.questionAsked$.next({ Question: { Id: 'hourly_rate', Text: '?', Chips: ['225'] } });
    api.turn.and.returnValue(of(turn({ Version: 1 })) as any);

    await state.say('225');

    expect(api.turn).toHaveBeenCalledWith(0, '225', 'hourly_rate');
  });

  it('sends no question id for unprompted dictation', async () => {
    api.turn.and.returnValue(of(turn({ Version: 1 })) as any);

    await state.say('3 שעות במשרד');

    expect(api.turn).toHaveBeenCalledWith(0, '3 שעות במשרד', null);
  });

  it('sends a cell edit as an UpdateRow op at the current version', async () => {
    api.canvasEdit.and.returnValue(of(turn({ Version: 2, Ops: [] })) as any);

    await state.editCell(0, { Hours: 7 });

    expect(api.canvasEdit).toHaveBeenCalledWith(0, [
      { Op: 'UpdateRow', Path: 'rows[0]', Value: { Hours: 7 } },
    ]);
  });

  it('re-syncs from the server when a cell edit conflicts', async () => {
    api.canvasEdit.and.returnValue(throwError(() => ({ status: 409 })) as any);
    api.session.and.returnValue(of(session(9)) as any);

    await state.editCell(0, { Hours: 7 });

    expect(state.version).withContext('server copy wins').toBe(9);
    expect(await firstValueFrom(state.error$)).toBeNull();
  });

  it('surfaces a turn failure without losing the draft', async () => {
    api.turn.and.returnValue(throwError(() => ({ error: { Error: 'boom' } })) as any);

    await state.say('משהו');

    expect(await firstValueFrom(state.error$)).toBe('boom');
    expect(state.version).toBe(0);
  });

  // Taken from the real exemplars: three invoices shipped billing 0.00 because the rate
  // cell was empty and nothing refused the export.
  it('refuses to export a document with no rate', async () => {
    api.turn.and.returnValue(of(turn({
      Version: 1, Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 32 } }],
    })) as any);
    await state.say('32 שעות');

    expect(state.canExport()).toBeFalse();
    expect(await firstValueFrom(state.error$)).toBe('docBuilder.errors.missingRate');
  });

  it('refuses to export a document with no rows', async () => {
    expect(state.canExport()).toBeFalse();
    expect(await firstValueFrom(state.error$)).toBe('docBuilder.errors.emptyDocument');
  });

  it('allows the export once the rate is entered', async () => {
    api.turn.and.returnValue(of(turn({
      Version: 1, Ops: [{ Op: 'AddRow', Path: 'rows', Value: { Hours: 32 } }],
    })) as any);
    await state.say('32 שעות');

    api.canvasEdit.and.returnValue(of(turn({
      Version: 2,
      Ops: [{ Op: 'SetTotals', Path: 'totals', Value: { Hours: 32, CarryIn: 760, Remaining: 728, HourlyRate: 225, VatPercent: 18, Total: 8496 } }],
    })) as any);
    await state.editTotalsInput('totals.hourlyRate', 225);

    expect(state.canExport()).toBeTrue();
    expect(await firstValueFrom(state.error$)).toBeNull();
  });

  it('sends a billing input as a SetField op', async () => {
    api.canvasEdit.and.returnValue(of(turn({ Version: 1 })) as any);

    await state.editTotalsInput('totals.carryIn', 760);

    expect(api.canvasEdit).toHaveBeenCalledWith(0, [
      { Op: 'SetField', Path: 'totals.carryIn', Value: 760 },
    ]);
  });

  // The hub only emits BuilderCommitCompleted on a commit, so nothing closed the progress
  // card after a turn or an import — the toast sat on the last agent line looking hung.
  it('closes the progress card when a turn returns', async () => {
    api.turn.and.returnValue(of(turn({ Version: 1 })) as any);

    await state.say('משהו');

    expect(hub.endTurn).toHaveBeenCalled();
  });

  it('closes the progress card when an upload returns', async () => {
    api.uploadExemplar.and.returnValue(of({
      Version: 1, Ops: [], SheetName: 'מרץ  2026 ', Rtl: true, MergeCount: 31, DataBandStartRow: 11,
    }) as any);

    await state.uploadExemplar(new File(['x'], 'exemplar.xlsx'));

    expect(hub.endTurn).toHaveBeenCalled();
  });

  it('fails the progress card when a turn throws', async () => {
    api.turn.and.returnValue(throwError(() => ({ error: { Error: 'boom' } })) as any);

    await state.say('משהו');

    expect(hub.failTurn).toHaveBeenCalledWith('boom');
    expect(hub.endTurn).not.toHaveBeenCalled();
  });

  it('applies the template patches an upload returns', async () => {
    api.uploadExemplar.and.returnValue(of({
      Version: 1,
      Ops: [{ Op: 'SetField', Path: 'template.rtl', Value: true }],
      SheetName: 'מרץ 2026', Rtl: true, MergeCount: 31, DataBandStartRow: 12,
    }) as any);

    await state.uploadExemplar(new File(['x'], 'exemplar.xlsx'));

    expect(state.draft.Template).toBeTruthy();
    expect(state.draft.Template!.Rtl).toBeTrue();
  });
});
