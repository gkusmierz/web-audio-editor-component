import { Component } from '../core/Component';
import { AudioEditorState } from '../types';
import { formatTime } from '../core/Utils';
export class TimeInfoDisplay extends Component<HTMLDivElement> {
     private selectionStartEl: HTMLSpanElement | null;
     private selectionDurationEl: HTMLSpanElement | null;
     private selectionEndEl: HTMLSpanElement | null;

     constructor(element: HTMLDivElement) {
         super(element);
         this.selectionStartEl = this.$('#selectionStart');
         this.selectionDurationEl = this.$('#selectionDuration');
         this.selectionEndEl = this.$('#selectionEnd');
     }

     render(state: AudioEditorState): void {
         const selStart = state.selection.start ?? 0;
         const selEnd = state.selection.end ?? 0;
         const selectionDuration = selEnd > selStart ? selEnd - selStart : 0;

         if (this.selectionStartEl) this.selectionStartEl.textContent = formatTime(selStart);
         if (this.selectionDurationEl) this.selectionDurationEl.textContent = formatTime(selectionDuration);
         if (this.selectionEndEl) this.selectionEndEl.textContent = formatTime(selEnd);
     }
}