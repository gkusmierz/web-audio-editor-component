import { Component } from '../core/Component';
import { AudioEditorState } from '../types';
import { formatTime } from '../core/Utils';
export class PlaybackControls extends Component<HTMLDivElement> {
    public onPlayPause: (() => void) | null = null;
    public onStop: (() => void) | null = null;
    public onLoopToggle: ((isChecked: boolean) => void) | null = null;
    public onPlaySelectionToggle: ((isChecked: boolean) => void) | null = null;

    private playPauseButton: HTMLButtonElement | null;
    private stopButton: HTMLButtonElement | null;
    private playIcon: HTMLElement | null;
    private pauseIcon: HTMLElement | null;
    private loopCheckbox: HTMLInputElement | null;
    private playSelectionCheckbox: HTMLInputElement | null;
    private positionDisplay: HTMLSpanElement | null;


    constructor(element: HTMLDivElement) {
        super(element);
        this.playPauseButton = this.$('#playPauseButton');
        this.stopButton = this.$('#stopButton');
        this.playIcon = this.$('#playPauseButton .play-icon');
        this.pauseIcon = this.$('#playPauseButton .pause-icon');
        this.loopCheckbox = this.$('#loopCheckbox');
        this.playSelectionCheckbox = this.$('#playSelectionCheckbox');
        this.positionDisplay = this.$('#currentPosition');
        this.bindEvents();
    }

    bindEvents(): void {
        if(this.playPauseButton) this.addListener(this.playPauseButton, 'click', () => this.onPlayPause?.());
        if(this.stopButton) this.addListener(this.stopButton, 'click', () => this.onStop?.());
        if(this.loopCheckbox) this.addListener(this.loopCheckbox, 'change', (e) => this.onLoopToggle?.((e.target as HTMLInputElement).checked));
        if(this.playSelectionCheckbox) this.addListener(this.playSelectionCheckbox, 'change', (e) => this.onPlaySelectionToggle?.((e.target as HTMLInputElement).checked));
    }

     render(state: AudioEditorState): void {
        const hasBuffer = !!state.audioBuffer;
        const canPlay = hasBuffer && !state.isRecording && !state.isLoading;

         // Play/Pause Button State
         if (this.playPauseButton) {
             this.playPauseButton.disabled = !canPlay;
             if (this.playIcon) this.playIcon.style.display = state.isPlaying ? 'none' : 'inline';
             if (this.pauseIcon) this.pauseIcon.style.display = state.isPlaying ? 'inline' : 'none';
             this.playPauseButton.title = state.isPlaying ? "Pause (Space)" : "Play (Space)";
         }

         // Stop Button State
         if (this.stopButton) {
             // Enable stop if playing or paused away from the start? Or just if buffer loaded?
             // Let's enable if buffer loaded and not recording/loading.
             this.stopButton.disabled = !canPlay;
         }

         // Checkboxes State (reflect internal state)
         if (this.loopCheckbox) this.loopCheckbox.checked = state.loopPlayback;
         if (this.playSelectionCheckbox) {
             this.playSelectionCheckbox.checked = state.playSelectionOnly;
              // Disable 'Play Selection' if there's no valid selection? Optional UX choice.
              // const hasSelection = state.selection.start !== null && state.selection.end !== null && state.selection.start < state.selection.end;
              // this.playSelectionCheckbox.disabled = !hasSelection;
         }


         // Position Display
         if (this.positionDisplay) {
             this.positionDisplay.textContent = formatTime(state.currentPosition);
         }
     }
}