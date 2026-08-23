import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  DocumentBuilderMessage,
  DocumentQuestion,
  DocumentWarning,
} from 'src/app/Infrastructure/Services/DocumentBuilder/document-builder.types';

/**
 * The conversation half of the builder.
 *
 * The planner asks one question at a time and the document waits: chips are the fast path
 * for the expected answers, free text for everything else. Both go back through the same
 * turn — a chip is just a pre-typed answer, never a separate code path.
 */
@Component({
  selector: 'app-builder-chat-rail',
  templateUrl: './builder-chat-rail.component.html',
  styleUrls: ['./builder-chat-rail.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuilderChatRailComponent {
  @Input() messages: DocumentBuilderMessage[] = [];
  @Input() question: DocumentQuestion | null = null;
  @Input() warnings: DocumentWarning[] = [];
  @Input() busy = false;

  @Output() send = new EventEmitter<string>();

  draftText = '';

  trackByIndex(index: number): number {
    return index;
  }

  submit(): void {
    const text = this.draftText.trim();
    if (!text || this.busy) return;
    this.send.emit(text);
    this.draftText = '';
  }

  /** A chip is an answer, not a shortcut around the turn. */
  chooseChip(chip: string): void {
    if (this.busy) return;
    this.send.emit(chip);
  }
}
