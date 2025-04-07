import { Component } from '../core/Component';
import { AudioEditorState } from '../types';
import { formatTime } from '../core/Utils';

export class TopBar extends Component<HTMLDivElement> {
    private fileInput: HTMLInputElement | null;
    private loadButtonLabel: HTMLLabelElement | null;
    private fileNameSpan: HTMLSpanElement | null;
    private totalDurationSpan: HTMLSpanElement | null;

    // Callback for when a file is selected
    public onFileLoad: ((file: File) => void) | null = null;

    constructor(element: HTMLDivElement) {
        super(element);
        this.fileInput = this.$<HTMLInputElement>('#audioFileInput');
        this.loadButtonLabel = this.$<HTMLLabelElement>('#loadButtonLabel');
        this.fileNameSpan = this.$<HTMLSpanElement>('#fileName');
        this.totalDurationSpan = this.$<HTMLSpanElement>('#totalDuration');
        this.bindEvents();
    }

    private bindEvents(): void {
        if (!this.fileInput) return;
        // Ensure listener uses the component instance's context
        this.addListener(this.fileInput, 'change', this.handleFileChange.bind(this));
    }

    private handleFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            if (this.onFileLoad) {
                this.onFileLoad(file);
            }
            // Reset input value to allow loading the same file again
            input.value = '';
        }
    }

    render(state: Pick<AudioEditorState, 'fileName' | 'totalDuration'>): void {
        if (this.fileNameSpan) {
            this.fileNameSpan.textContent = state.fileName || 'No file loaded';
            this.fileNameSpan.title = state.fileName || 'No file loaded'; // Tooltip for long names
        }
        if (this.totalDurationSpan) {
            this.totalDurationSpan.textContent = `Total: ${formatTime(state.totalDuration)}`;
        }
        // Potentially disable load button while loading/recording?
        // if (this.loadButtonLabel) {
        //     const isDisabled = state.isLoading || state.isRecording;
        //     this.loadButtonLabel.style.opacity = isDisabled ? '0.6' : '1';
        //     this.loadButtonLabel.style.pointerEvents = isDisabled ? 'none' : 'auto';
        //     if(this.fileInput) this.fileInput.disabled = isDisabled;
        // }
    }
}