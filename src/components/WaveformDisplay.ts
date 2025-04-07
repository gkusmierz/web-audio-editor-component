import { Component } from '../core/Component';
import { AudioEditorState, SelectionRange } from '../types';
import { clamp } from '../core/Utils';

export class WaveformDisplay extends Component<HTMLDivElement> {
    private canvas: HTMLCanvasElement | null;
    private ctx: CanvasRenderingContext2D | null = null;
    private selectionOverlay: HTMLDivElement | null;
    private playhead: HTMLDivElement | null;
    private loadingIndicator: HTMLDivElement | null;
    private recordingIndicator: HTMLDivElement | null;

    private isDragging: boolean = false;
    private dragStartX: number | null = null;
    private dragStartSeconds: number | null = null;
    private currentTotalDuration: number = 0; // Cache duration for calculations

    // Callbacks for interaction
    public onSelectionChange: ((selection: SelectionRange) => void) | null = null;
    public onPlayheadSeek: ((time: number) => void) | null = null;

    // Cache peaks data to avoid requesting it constantly
    private currentPeaksData: number[][] | null = null;

    // Observer for resizing
    private resizeObserver: ResizeObserver | null = null;

    constructor(element: HTMLDivElement) {
        super(element);
        this.canvas = this.$<HTMLCanvasElement>('#waveformCanvas');
        this.selectionOverlay = this.$<HTMLDivElement>('#selectionOverlay');
        this.playhead = this.$<HTMLDivElement>('#playhead');
        this.loadingIndicator = this.$<HTMLDivElement>('#loadingIndicator');
        this.recordingIndicator = this.$<HTMLDivElement>('#recordingIndicator');

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d', { alpha: false }); // Improve performance if no transparency needed
            // Set initial canvas size
            this.resizeCanvas();
            this.clearCanvas(); // Clear initially
        }
        this.bindEvents();
    }

    private clearCanvas(): void {
        if (!this.ctx || !this.canvas) return;
        // Use clientWidth/Height which reflect CSS size
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.ctx.fillStyle = '#f2f2f7'; // Match container background
        this.ctx.fillRect(0, 0, width, height);
    }

    private resizeCanvas(): void {
        if (!this.canvas || !this.element) return;
        // Use devicePixelRatio for sharper rendering on high-DPI screens
        const dpr = window.devicePixelRatio || 1;
        // Get dimensions from the *container* element, not the canvas itself initially
        const rect = this.element.getBoundingClientRect();

        // Check if dimensions are valid
        if (rect.width <= 0 || rect.height <= 0) {
            return; // Don't resize if element is not visible or has no size
        }

        // Update canvas internal bitmap size
        this.canvas.width = Math.round(rect.width * dpr);
        this.canvas.height = Math.round(rect.height * dpr);

        // Update canvas CSS size to fit container
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        // Scale the drawing context
        this.ctx?.scale(dpr, dpr);
    }

    private bindEvents(): void {
        if (!this.element || !this.canvas) return;

        // Use ResizeObserver to redraw on resize
        this.resizeObserver = new ResizeObserver(entries => {
             // Only resize/redraw if the observed element's size actually changed
             const entry = entries[0];
             if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                this.resizeCanvas();
                // Trigger a redraw using cached data
                this.redrawWaveform();
             }
        });
        this.resizeObserver.observe(this.element);


        // Mouse events for selection / seeking
        // Bind 'this' explicitly or use arrow functions
        const handleMouseDown = this.handleMouseDown.bind(this);
        const handleMouseMove = this.handleMouseMove.bind(this);
        const handleMouseUp = this.handleMouseUp.bind(this);

        this.addListener(this.canvas, 'mousedown', handleMouseDown);
        // Add mouse move/up listeners to the document to capture drags outside the canvas
        this.addListener(document.documentElement, 'mousemove', handleMouseMove);
        this.addListener(document.documentElement, 'mouseup', handleMouseUp);

        // Prevent default browser drag behavior on the canvas
        this.addListener(this.canvas, 'dragstart', (e) => e.preventDefault());
    }

    // Method to explicitly request a redraw (e.g., after state update)
    private redrawWaveform(): void {
        if (!this.ctx || !this.canvas || !this.currentPeaksData) {
            this.clearCanvas(); // Clear if no data
            // Optionally draw "No audio data" message here too
            if (this.currentTotalDuration <=0 && !this.loadingIndicator?.style.display.includes('block')) {
                 this.drawNoAudioMessage();
            }
            return;
        }
        this.drawWaveform(this.currentPeaksData, this.currentTotalDuration);
    }

     private drawNoAudioMessage(): void {
        if (!this.ctx || !this.canvas) return;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.clearCanvas(); // Ensure background is cleared
        this.ctx.fillStyle = '#6c6c70'; // Darker gray text
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Load or record audio', width / 2, height / 2);
    }

    private getSecondsFromX(x: number): number {
        if (!this.canvas || this.currentTotalDuration <= 0) return 0;
        const rect = this.canvas.getBoundingClientRect();
        // Calculate relative X within the canvas bounds
        const relativeX = clamp(x - rect.left, 0, rect.width);
        return (relativeX / rect.width) * this.currentTotalDuration;
    }

    private getXFromSeconds(seconds: number): number {
        if (!this.canvas || this.currentTotalDuration <= 0) return 0;
        const rect = this.canvas.getBoundingClientRect();
        // Clamp seconds to valid range before calculating X
        const clampedSeconds = clamp(seconds, 0, this.currentTotalDuration);
        return clamp((clampedSeconds / this.currentTotalDuration) * rect.width, 0, rect.width);
    }

    private handleMouseDown(event: MouseEvent): void {
        // Only react to primary button clicks
        if (event.button !== 0 || !this.element.isConnected || !this.canvas) return;

        // Prevent text selection during drag
        event.preventDefault();

        this.isDragging = true;
        this.dragStartX = event.clientX;
        this.dragStartSeconds = this.getSecondsFromX(event.clientX);

        // Immediately set start of selection or trigger seek visually if needed
        // Emit the initial single-point selection
        if (this.onSelectionChange) {
             this.onSelectionChange({ start: this.dragStartSeconds, end: this.dragStartSeconds });
        }

        // Update overlay for immediate feedback (a tiny sliver at the start point)
        if (this.selectionOverlay && this.currentTotalDuration > 0) {
            const startX = this.getXFromSeconds(this.dragStartSeconds);
            this.selectionOverlay.style.left = `${startX}px`;
            this.selectionOverlay.style.width = `0px`; // Start with zero width
            this.selectionOverlay.style.display = 'block'; // Make it visible
        }
    }

     private handleMouseMove(event: MouseEvent): void {
         // Check if dragging was initiated *within this component*
        if (!this.isDragging || this.dragStartX === null || this.dragStartSeconds === null) return;

        const currentSeconds = this.getSecondsFromX(event.clientX);

        const start = Math.min(this.dragStartSeconds, currentSeconds);
        const end = Math.max(this.dragStartSeconds, currentSeconds);

         // Update visual selection overlay only if dragging
         if (this.selectionOverlay && this.currentTotalDuration > 0) {
            const startX = this.getXFromSeconds(start);
            const endX = this.getXFromSeconds(end);
            this.selectionOverlay.style.left = `${startX}px`;
            this.selectionOverlay.style.width = `${Math.max(0, endX - startX)}px`; // Ensure width isn't negative
            this.selectionOverlay.style.display = 'block'; // Ensure visible
         }

        // Emit selection change continuously during drag
        if (this.onSelectionChange) {
            this.onSelectionChange({ start, end });
        }
    }

    private handleMouseUp(event: MouseEvent): void {
        // Only react if a drag was active *within this component*
        if (!this.isDragging || this.dragStartSeconds === null) {
             this.isDragging = false; // Reset just in case
             return;
        }
         // Only react to primary button release
        if (event.button !== 0) return;


        const endSeconds = this.getSecondsFromX(event.clientX);

        // Check for a click (minimal drag distance/time could also be used)
        const clickThreshold = 3; // pixels
        const wasClick = this.dragStartX !== null && Math.abs(event.clientX - this.dragStartX) < clickThreshold;

        if (wasClick) {
            // Click: Seek playhead
            if (this.onPlayheadSeek) {
                this.onPlayheadSeek(this.dragStartSeconds); // Seek to the initial click position
            }
            // Clear visual selection and state on click
            if (this.onSelectionChange) {
                this.onSelectionChange({ start: null, end: null });
            }
             if (this.selectionOverlay) this.selectionOverlay.style.display = 'none';

        } else {
             // Drag end: Finalize selection range
             const start = Math.min(this.dragStartSeconds, endSeconds);
             const end = Math.max(this.dragStartSeconds, endSeconds);
             if (this.onSelectionChange) {
                 // Emit the final, potentially adjusted selection
                 this.onSelectionChange({ start, end });
             }
             // Keep the overlay visible showing the final selection
             if (this.selectionOverlay && this.currentTotalDuration > 0) {
                 const startX = this.getXFromSeconds(start);
                 const endX = this.getXFromSeconds(end);
                 this.selectionOverlay.style.left = `${startX}px`;
                 this.selectionOverlay.style.width = `${Math.max(0, endX - startX)}px`;
                 this.selectionOverlay.style.display = 'block';
             }
        }

        // Reset dragging state IMPORTANTLY *after* processing
        this.isDragging = false;
        this.dragStartX = null;
        this.dragStartSeconds = null;
    }


    /** Draws the waveform using pre-calculated min/max peak data */
    private drawWaveform(peaks: number[][], totalDuration: number): void {
        if (!this.ctx || !this.canvas || peaks.length === 0 || peaks[0].length === 0 || totalDuration <= 0) {
             this.clearCanvas();
             if (totalDuration <= 0 && !this.loadingIndicator?.style.display.includes('block')) {
                 this.drawNoAudioMessage();
             }
             return;
        }

        const width = this.canvas.clientWidth; // Use clientWidth for CSS pixels
        const height = this.canvas.clientHeight;
        this.clearCanvas(); // Clear previous frame

        const numChannels = peaks.length;
        const channelHeight = height / numChannels;
        const halfChannelHeight = channelHeight / 2;

        this.ctx.lineWidth = 1;
        this.ctx.strokeStyle = '#007aff'; // Blue waveform

        for (let c = 0; c < numChannels; c++) {
            const channelPeaks = peaks[c];
            const offsetY = c * channelHeight + halfChannelHeight;
            const numPeaks = channelPeaks.length / 2; // Since we store min/max pairs

            this.ctx.beginPath();
            this.ctx.moveTo(0, offsetY); // Start at the center line

            for (let i = 0; i < numPeaks; i++) {
                 const x = (i / numPeaks) * width; // Map peak index to x coordinate

                 const minPeak = channelPeaks[i * 2];     // Min value for this segment
                 const maxPeak = channelPeaks[i * 2 + 1]; // Max value for this segment

                 // Scale peak values (-1 to 1) to pixel heights
                 const minY = offsetY + minPeak * halfChannelHeight; // Adding negative value moves up
                 const maxY = offsetY + maxPeak * halfChannelHeight; // Adding positive value moves down

                 // Draw a vertical line from min to max peak for this segment
                 // Optimize by drawing line only if peaks are not zero
                 if (minPeak !== 0 || maxPeak !== 0) {
                      this.ctx.moveTo(x, minY);
                      this.ctx.lineTo(x, maxY);
                 } else {
                      // Draw a tiny dot or nothing if segment is silent
                      // this.ctx.moveTo(x, offsetY);
                      // this.ctx.lineTo(x, offsetY); // Draw center line for silence
                 }

            }
             this.ctx.stroke(); // Stroke the path for the current channel
        }
    }


    render(state: AudioEditorState, peaksData?: number[][]): void {
         // Cache duration and peaks for internal use (like mouse events, redraws)
         this.currentTotalDuration = state.totalDuration;
         let needsRedraw = false;
         if (peaksData && peaksData !== this.currentPeaksData) {
             this.currentPeaksData = peaksData;
             needsRedraw = true; // Redraw if new peak data arrives
         } else if (!state.audioBuffer && this.currentPeaksData !== null) {
             // If buffer removed, clear peaks and redraw
             this.currentPeaksData = null;
             needsRedraw = true;
         }

         // Force redraw on buffer load/clear or resize (handled by observer)
         if (needsRedraw) {
             this.redrawWaveform();
         }

        // Update Loading/Recording Indicators
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = state.isLoading ? 'block' : 'none';
        }
        if (this.recordingIndicator) {
            this.recordingIndicator.style.display = state.isRecording ? 'block' : 'none';
             // If recording starts, clear waveform and peaks
             if (state.isRecording && this.currentPeaksData) {
                 this.currentPeaksData = null;
                 this.clearCanvas();
                  this.ctx?.fillText('Recording...', this.canvas!.clientWidth / 2, this.canvas!.clientHeight / 2); // Optional message
             }
        }

        // Update Selection Overlay based on state (even if not dragging)
        if (this.selectionOverlay && this.canvas && state.totalDuration > 0) {
             if (state.selection.start !== null && state.selection.end !== null && state.selection.start < state.selection.end) {
                 // Only update if selection range is valid and different from current drag state
                 // This prevents flickering during drag, letting handleMouseMove control it
                 if (!this.isDragging) {
                     const startX = this.getXFromSeconds(state.selection.start);
                     const endX = this.getXFromSeconds(state.selection.end);
                     this.selectionOverlay.style.left = `${startX}px`;
                     this.selectionOverlay.style.width = `${Math.max(0, endX - startX)}px`;
                     this.selectionOverlay.style.display = 'block';
                 }
             } else if (!this.isDragging) { // Hide if selection is invalid/cleared and not currently dragging
                 this.selectionOverlay.style.display = 'none';
             }
         } else if (this.selectionOverlay && !this.isDragging) {
             // Hide if no duration or not dragging
             this.selectionOverlay.style.display = 'none';
         }


        // Update Playhead Position
        if (this.playhead && this.canvas && state.totalDuration > 0) {
             // Show if playing, or paused not at the very beginning
             const showPlayhead = state.isPlaying || (!state.isPlaying && state.currentPosition > 1e-3); // Use small epsilon

             if (showPlayhead) {
                 const playheadX = this.getXFromSeconds(state.currentPosition);
                 this.playhead.style.left = `${playheadX}px`;
                 this.playhead.style.display = 'block';
             } else {
                 this.playhead.style.display = 'none';
             }
         } else if (this.playhead) {
             // Hide if no duration
             this.playhead.style.display = 'none';
         }
    }

     // Clean up observer
     destroy(): void {
         if (this.resizeObserver && this.element) {
             this.resizeObserver.unobserve(this.element);
         }
         this.resizeObserver = null;
         // Remove document listeners explicitly if Component base class doesn't handle it
         // (Assuming Component.addListener returns a cleanup function,
         // we'd need to store and call those functions in AudioEditor.destroy)
     }
}