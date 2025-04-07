import { Component } from '../core/Component';
import { AudioEditorState } from '../types';
export class ControlsBar extends Component<HTMLDivElement> {
    // --- Define callbacks for buttons ---
    public onCut: (() => void) | null = null;
    public onCopy: (() => void) | null = null;
    public onPaste: (() => void) | null = null;
    public onDelete: (() => void) | null = null;
    public onRecord: (() => void) | null = null;
    public onUndo: (() => void) | null = null;
    public onRedo: (() => void) | null = null;
    public onZoomIn: (() => void) | null = null;
    public onZoomOut: (() => void) | null = null;
    public onZoomFit: (() => void) | null = null;

    // --- Button elements ---
    private cutButton: HTMLButtonElement | null;
    private copyButton: HTMLButtonElement | null;
    private pasteButton: HTMLButtonElement | null;
    private deleteButton: HTMLButtonElement | null;
    private recordButton: HTMLButtonElement | null;
    private undoButton: HTMLButtonElement | null;
    private redoButton: HTMLButtonElement | null;
    private zoomInButton: HTMLButtonElement | null;
    private zoomOutButton: HTMLButtonElement | null;
    private zoomFitButton: HTMLButtonElement | null;
    // ... add other buttons ...

    constructor(element: HTMLDivElement) {
        super(element);
        // --- Find buttons ---
        this.cutButton = this.$('#cutButton');
        this.copyButton = this.$('#copyButton');
        this.pasteButton = this.$('#pasteButton');
        this.deleteButton = this.$('#deleteButton');
        this.recordButton = this.$('#recordButton');
        this.undoButton = this.$('#undoButton');
        this.redoButton = this.$('#redoButton');
        this.zoomInButton = this.$('#zoomInButton');
        this.zoomOutButton = this.$('#zoomOutButton');
        this.zoomFitButton = this.$('#zoomFitButton');
        // ... find others ...
        this.bindEvents();
    }

    private bindEvents(): void {
        // --- Add listeners ---
        if(this.cutButton) this.addListener(this.cutButton, 'click', () => this.onCut?.());
        if(this.copyButton) this.addListener(this.copyButton, 'click', () => this.onCopy?.());
        if(this.pasteButton) this.addListener(this.pasteButton, 'click', () => this.onPaste?.());
        if(this.deleteButton) this.addListener(this.deleteButton, 'click', () => this.onDelete?.());
        if(this.recordButton) this.addListener(this.recordButton, 'click', () => this.onRecord?.());
        if(this.undoButton) this.addListener(this.undoButton, 'click', () => this.onUndo?.());
        if(this.redoButton) this.addListener(this.redoButton, 'click', () => this.onRedo?.());
        if(this.zoomInButton) this.addListener(this.zoomInButton, 'click', () => this.onZoomIn?.());
        if(this.zoomOutButton) this.addListener(this.zoomOutButton, 'click', () => this.onZoomOut?.());
        if(this.zoomFitButton) this.addListener(this.zoomFitButton, 'click', () => this.onZoomFit?.());
        // ... add others ...
    }

    render(state: AudioEditorState): void {
        const hasBuffer = !!state.audioBuffer;
        const hasSelection = state.selection.start !== null && state.selection.end !== null && state.selection.start < state.selection.end;
        const canPaste = !!state.clipboardBuffer;
        const isIdle = !state.isLoading && !state.isRecording;

        // --- Update button disabled states ---
        if(this.cutButton) this.cutButton.disabled = !hasSelection || !isIdle;
        if(this.copyButton) this.copyButton.disabled = !hasSelection || !isIdle;
        if(this.pasteButton) this.pasteButton.disabled = !canPaste || !hasBuffer || !isIdle;
        if(this.deleteButton) this.deleteButton.disabled = !hasSelection || !isIdle;
        if(this.undoButton) this.undoButton.disabled = !state.canUndo || !isIdle;
        if(this.redoButton) this.redoButton.disabled = !state.canRedo || !isIdle;
        if(this.zoomInButton) this.zoomInButton.disabled = !hasBuffer || !isIdle; // Basic enablement
        if(this.zoomOutButton) this.zoomOutButton.disabled = !hasBuffer || !isIdle; // Basic enablement
        if(this.zoomFitButton) this.zoomFitButton.disabled = !hasBuffer || !isIdle; // Basic enablement

         // Record button styling
         if(this.recordButton) {
             this.recordButton.disabled = state.isLoading; // Disable only while loading
             const icon = this.recordButton.querySelector('.icon');
             if (state.isRecording) {
                 this.recordButton.classList.add('recording'); // Add class for CSS styling
                 this.recordButton.title = "Stop Recording (R)";
                 if(icon) icon.textContent = '⏹️'; // Change icon to Stop
             } else {
                 this.recordButton.classList.remove('recording');
                 this.recordButton.title = "Record from Microphone (R)";
                  if(icon) icon.textContent = '🎤'; // Change icon back to Mic
             }
         }
    }
}