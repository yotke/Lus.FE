import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * The fork in the road: one entry point, two ways to reach the same workbook.
 *
 * Replaces the pair of buttons that used to sit on the home screen — putting both lanes
 * behind one choice lets each be explained rather than guessed at from a label.
 */
@Component({
  selector: 'app-create-chooser',
  templateUrl: './create-chooser.component.html',
  styleUrls: ['./create-chooser.component.scss'],
})
export class CreateChooserComponent {
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() chooseClassic = new EventEmitter<void>();
  @Output() chooseAi = new EventEmitter<void>();

  /** Escape closes it — a modal that traps the user is a broken modal. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) this.closed.emit();
  }
}
