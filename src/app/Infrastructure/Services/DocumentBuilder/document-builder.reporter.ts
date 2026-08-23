import { Injectable } from '@angular/core';
import { BaseProgressReporter } from '../ProgressReporter/base-progress-reporter';
import { ReporterConfig } from '../ProgressReporter/progress-reporter.types';
import { ProgressReporterRegistry } from '../ProgressReporter/progress-reporter-registry.service';
import { WorkflowType } from '../SignalR/workflow-types';

/**
 * The Document Builder's card in the toast stack.
 *
 * `startExpanded` mirrors ArmyLuz's org-creation reporter: the stage-by-stage narration
 * IS the product here — the user is watching agents fill their document — so the detail
 * panel opens on the first event rather than waiting for a chevron click.
 */
@Injectable({ providedIn: 'root' })
export class DocumentBuilderReporter extends BaseProgressReporter {
  protected get config(): ReporterConfig {
    return {
      key: 'document-builder',
      workflowType: WorkflowType.DocumentBuilder,
      startExpanded: true,
      autoDismissMs: 8000,
      errorDismissMs: 15000,
    };
  }

  constructor(registry: ProgressReporterRegistry) {
    super();
    registry.register(this);
  }
}
