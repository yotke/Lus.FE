import { Component } from '@angular/core';
import { ProgressReporterRegistry } from 'src/app/Infrastructure/Services/ProgressReporter/progress-reporter-registry.service';
import { ReporterStatus } from 'src/app/Infrastructure/Services/ProgressReporter/progress-reporter.types';
import { LanguageService } from 'src/app/Infrastructure/Services/languageService/language.service';

/**
 * The side toast — one card per visible reporter, bottom-anchored, never blocking.
 *
 * Replaces the full-screen CDK overlay: routine HTTP traffic and the Document Builder's
 * agent narration share this one stack, so there is a single place progress is shown and
 * a single set of styles to maintain.
 */
@Component({
  selector: 'app-progress-toast',
  templateUrl: './progress-toast.component.html',
  styleUrls: ['./progress-toast.component.scss'],
})
export class ProgressToastComponent {
  constructor(
    public registry: ProgressReporterRegistry,
    public langSvc: LanguageService,
  ) { }

  /** trackBy for the ngFor — prevents DOM thrashing as percentages tick. */
  trackByKey(_index: number, item: ReporterStatus): string {
    return item.key;
  }

  dismissReporter(key: string): void {
    this.registry.get(key)?.dismiss();
  }

  toggleReporterExpanded(key: string): void {
    this.registry.get(key)?.toggleExpanded();
  }
}
