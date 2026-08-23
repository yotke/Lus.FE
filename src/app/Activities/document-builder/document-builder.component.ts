import { Component, OnInit } from '@angular/core';
import { BuilderStateService } from 'src/app/Infrastructure/Services/DocumentBuilder/builder-state.service';
import { DraftWorkbookService } from 'src/app/Infrastructure/Services/DocumentBuilder/draft-workbook.service';

/**
 * The AI lane.
 *
 * `/TimeManagement` remains the manual lane and is untouched; this screen is the other way
 * to reach the same kind of document: upload an exemplar, talk to it, watch agents fill it,
 * and correct any cell by hand. Both lanes end in the same workbook.
 */
@Component({
  selector: 'app-document-builder',
  templateUrl: './document-builder.component.html',
  styleUrls: ['./document-builder.component.scss'],
})
export class DocumentBuilderComponent implements OnInit {
  dragOver = false;

  constructor(
    public state: BuilderStateService,
    private workbook: DraftWorkbookService,
  ) { }

  ngOnInit(): void {
    // Failure here is surfaced through the service's error$ — the screen still renders.
    void this.state.init();
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void this.state.uploadExemplar(file);
    // Clear it so choosing the same file twice fires again.
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.state.uploadExemplar(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onCellEdit(edit: { rowIndex: number; patch: Record<string, unknown> }): void {
    void this.state.editCell(edit.rowIndex, edit.patch);
  }

  onTotalsEdit(edit: { path: string; value: number | null }): void {
    void this.state.editTotalsInput(edit.path, edit.value);
  }

  onAddRow(): void { void this.state.addRow(); }
  onRemoveRow(index: number): void { void this.state.removeRow(index); }
  onSend(text: string): void { void this.state.say(text); }
  /**
   * Format at the end, not the beginning: the draft becomes a workbook only when asked —
   * and only when it can price itself. Three real invoices shipped to a client billing 0.00
   * for 154 hours of work because nothing stopped an export with an empty rate.
   */
  onExport(): void {
    if (!this.state.canExport()) return;
    this.workbook.download(this.state.draft);
  }

  onUndo(): void { void this.state.undo(); }
  onRedo(): void { void this.state.redo(); }
}
