import { TopBar } from './TopBar';
import { ControlsBar } from './ControlsBar'; // Assume created
import { TimeInfoDisplay } from './TimeInfoDisplay'; // Assume created
import { WaveformDisplay } from '../core/WaveformDisplay';
import { PlaybackControls } from './PlaybackControls'; // Assume created
import { AudioManager } from '../core/AudioManager';
// import { HistoryManager } from '../core/HistoryManager'; // For Undo/Redo (future)
import { AudioEditorState, AudioEditorEvent, SelectionRange } from '../types';
import { formatTime } from '../core/Utils';

export class AudioEditor extends EventTarget {
    private element: HTMLElement;
    private state: AudioEditorState;
    private audioManager: AudioManager;
    // private historyManager: HistoryManager; // Add later for undo/redo

    // Components
    private topBar: TopBar;
    private controlsBar: ControlsBar; // Assume ControlsBar class exists
    private timeInfoDisplay: TimeInfoDisplay; // Assume TimeInfoDisplay class exists
    private waveformDisplay: WaveformDisplay;
    private playbackControls: PlaybackControls; // Assume PlaybackControls class exists

    private animationFrameId: number | null = null;
    private peaksData: number[][] | null = null; // Cached peaks for drawing
    private peakGenerationDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

    // Trackers for state changes that require peak recalculation
    private lastBufferProcessedForPeaks: AudioBuffer | null = null;
    private lastWidthForPeaks: number = 0;


    constructor(containerId: string, initialHtml: string) {
        super();
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container element with id "${containerId}" not found.`);
        }
        // Inject the HTML structure
        container.innerHTML = initialHtml;
        // Get the main editor element *after* injecting HTML
        const editorElement = container.querySelector<HTMLElement>('.audio-editor');
        if (!editorElement) {
             throw new Error("'.audio-editor' element not found within the container after injecting HTML.");
        }
        this.element = editorElement;

        try {
            this.audioManager = new AudioManager();
        } catch (error: any) {
            console.error("Failed to initialize AudioManager:", error);
            // Display error in the UI?
             this.element.innerHTML = `<div style="color: red; padding: 20px;">Error initializing audio: ${error.message}. Web Audio API might not be supported.</div>`;
             throw error; // Prevent further initialization
        }
        // this.historyManager = new HistoryManager();

        this.state = this.getInitialState();

        // Instantiate Components (find elements within the injected HTML)
        const topBarEl = this.element.querySelector<HTMLDivElement>('.top-bar');
        const controlsBarEl = this.element.querySelector<HTMLDivElement>('.controls-bar');
        const timeInfoEl = this.element.querySelector<HTMLDivElement>('.time-info');
        const waveformContainerEl = this.element.querySelector<HTMLDivElement>('.waveform-container');
        const playbackControlsEl = this.element.querySelector<HTMLDivElement>('.playback-controls');


        if (!topBarEl) throw new Error("TopBar element (.top-bar) not found");
        if (!controlsBarEl) throw new Error("ControlsBar element (.controls-bar) not found");
        if (!timeInfoEl) throw new Error("TimeInfoDisplay element (.time-info) not found");
        if (!waveformContainerEl) throw new Error("WaveformDisplay element (.waveform-container) not found");
        if (!playbackControlsEl) throw new Error("PlaybackControls element (.playback-controls) not found");


        // --- Assume placeholder component classes exist ---
        // You'll need to create these files similar to TopBar/WaveformDisplay
        this.topBar = new TopBar(topBarEl);
        this.waveformDisplay = new WaveformDisplay(waveformContainerEl);
         // Replace with actual component instantiation when they are created:
         this.controlsBar = new ControlsBar(controlsBarEl); // Placeholder instance
         this.timeInfoDisplay = new TimeInfoDisplay(timeInfoEl); // Placeholder instance
         this.playbackControls = new PlaybackControls(playbackControlsEl); // Placeholder instance
        // --- End Placeholder ---


        this.bindComponentEvents();
        this.render(); // Initial render
        this.requestPeakGeneration(); // Attempt initial peak generation if needed (e.g., on resize)
    }

    private getInitialState(): AudioEditorState {
        return {
            fileName: null,
            audioBuffer: null,
            totalDuration: 0,
            currentPosition: 0,
            isPlaying: false,
            isRecording: false,
            isLoading: false,
            selection: { start: null, end: null },
            zoomLevel: 1,
            canUndo: false, // historyManager.canUndo()
            canRedo: false, // historyManager.canRedo()
            clipboardBuffer: null,
            playSelectionOnly: false,
            loopPlayback: false,
        };
    }

    // Debounced peak generation
    private requestPeakGeneration(immediate = false): void {
        if (this.peakGenerationDebounceTimeout) {
            clearTimeout(this.peakGenerationDebounceTimeout);
            this.peakGenerationDebounceTimeout = null;
        }

        const generate = () => {
            if (!this.state.audioBuffer || !this.waveformDisplay['canvas']) return; // Access canvas via bracket notation if private

            const canvasWidth = this.waveformDisplay['canvas'].clientWidth; // Get current display width

             // Only regenerate if buffer changed or width changed significantly
             if (this.state.audioBuffer !== this.lastBufferProcessedForPeaks || canvasWidth !== this.lastWidthForPeaks) {
                 if (canvasWidth > 0) {
                     // console.log(`Generating peaks for width: ${canvasWidth}`);
                     this.peaksData = this.audioManager.getPeaks(this.state.audioBuffer, canvasWidth);
                     this.lastBufferProcessedForPeaks = this.state.audioBuffer;
                     this.lastWidthForPeaks = canvasWidth;
                     this.render(); // Re-render waveform with new peaks
                 }
             }
        };

        if (immediate) {
            generate();
        } else {
            // Debounce slightly to avoid excessive generation during resize
            this.peakGenerationDebounceTimeout = setTimeout(generate, 50);
        }
    }


    private bindComponentEvents(): void {
        // Top Bar
        this.topBar.onFileLoad = this.handleFileLoad.bind(this);

        // Waveform Display
        this.waveformDisplay.onSelectionChange = this.handleSelectionChange.bind(this);
        this.waveformDisplay.onPlayheadSeek = this.handleSeek.bind(this);
         // Listen for resize within WaveformDisplay to regenerate peaks
         const waveformCanvas = this.waveformDisplay['canvas']; // Access canvas if private
         if (waveformCanvas) {
            const resizeObserver = new ResizeObserver(() => {
                this.requestPeakGeneration(); // Request peaks on resize
            });
            resizeObserver.observe(waveformCanvas);
         }


        // --- Bind events from actual component implementations ---
        // Controls Bar (Example bindings - implement these in ControlsBar.ts)
        this.controlsBar.onCut = this.cut.bind(this);
        this.controlsBar.onCopy = this.copy.bind(this);
        this.controlsBar.onPaste = this.paste.bind(this);
        this.controlsBar.onDelete = this.deleteSelection.bind(this);
        this.controlsBar.onRecord = this.toggleRecording.bind(this); // Use a toggle function
        this.controlsBar.onUndo = this.undo.bind(this);
        this.controlsBar.onRedo = this.redo.bind(this);
        this.controlsBar.onZoomIn = this.zoomIn.bind(this);
        this.controlsBar.onZoomOut = this.zoomOut.bind(this);
        this.controlsBar.onZoomFit = this.zoomToFit.bind(this);

        // Playback Controls (Example bindings - implement these in PlaybackControls.ts)
        this.playbackControls.onPlayPause = this.togglePlayPause.bind(this); // Use a toggle function
        this.playbackControls.onStop = this.stop.bind(this);
        this.playbackControls.onLoopToggle = (isChecked) => this.setState({ loopPlayback: isChecked });
        this.playbackControls.onPlaySelectionToggle = (isChecked) => this.setState({ playSelectionOnly: isChecked });

        // Keyboard shortcuts (Listen on the document or a main container)
        this.element.setAttribute('tabindex', '-1'); // Make editor focusable for key events
         this.addListener(this.element, 'keydown', this.handleKeyDown.bind(this));
    }

     // Central state update function
    private setState(newState: Partial<AudioEditorState>): void {
        const previousState = { ...this.state };
        this.state = { ...this.state, ...newState };

        // --- Trigger side effects based on state changes ---

        // If audio buffer changes, request new peaks
        if (newState.audioBuffer !== undefined && newState.audioBuffer !== previousState.audioBuffer) {
             this.lastBufferProcessedForPeaks = null; // Force regeneration
             this.requestPeakGeneration(true); // Generate immediately
             // Reset history when buffer changes significantly (load, record, edit)
             // this.historyManager.clear();
             // if (newState.audioBuffer) {
             //     this.historyManager.addInitialState(newState.audioBuffer);
             // }
             this.setState({ canUndo: false, canRedo: false }); // Update undo/redo state
        }

         // If loop or play selection changes while playing, potentially restart playback
         if ( (newState.loopPlayback !== undefined && newState.loopPlayback !== previousState.loopPlayback && this.state.isPlaying) ||
              (newState.playSelectionOnly !== undefined && newState.playSelectionOnly !== previousState.playSelectionOnly && this.state.isPlaying)) {
             this.restartPlaybackWithNewSettings();
         }


        // --- Render all components ---
        // Pass previous state for comparison if components optimize rendering
        this.render(previousState);
    }

     private restartPlaybackWithNewSettings(): void {
         if (!this.state.isPlaying || !this.state.audioBuffer) return;
         // Store current position before stopping
         const currentPos = this.audioManager.getCurrentPlaybackPosition(this.state.totalDuration);
         this.audioManager.stopPlaybackInternal(false); // Stop source but keep position
         // Ensure the position is updated in the state *before* restarting play
         this.state.currentPosition = currentPos;
         this.audioManager.play(this.state.audioBuffer, this.state, this.handlePlaybackEnded.bind(this));
         // No need to call setState({isPlaying: true}) as it should already be true
         // Ensure timer restarts if it stopped
         this.startPlaybackTimer();
     }

    // --- Event Handlers ---

    private async handleFileLoad(file: File): Promise<void> {
        if (this.state.isLoading || this.state.isRecording) return;
        this.stop(true); // Stop playback & reset position
        this.setState({
            isLoading: true,
            fileName: `Loading: ${file.name}...`,
            audioBuffer: null,
            totalDuration: 0,
            currentPosition: 0,
            selection: {start: null, end: null},
            peaksData: null // Clear peaks
        });
        try {
            const { buffer, fileName } = await this.audioManager.loadAudioFile(file);
            // Trigger state update which will handle peak generation
            this.setState({
                audioBuffer: buffer,
                fileName: fileName,
                totalDuration: buffer.duration,
                isLoading: false,
                currentPosition: 0, // Ensure position is reset
            });
            this.dispatchEvent(new CustomEvent<AudioEditorEvent>('audioloaded', {
                detail: { type: 'audioloaded', payload: { fileName, duration: buffer.duration } }
            }));
        } catch (error: any) {
            console.error("Error loading audio file:", error);
            this.setState({
                isLoading: false,
                fileName: 'Error loading file',
                audioBuffer: null,
                totalDuration: 0,
                error: error.message // Store error message in state?
            });
             this.dispatchEvent(new CustomEvent<AudioEditorEvent>('error', {
                detail: { type: 'error', payload: { message: `Failed to load audio: ${error.message}` } }
            }));
        }
    }

     private handleSelectionChange(selection: SelectionRange): void {
        // Basic validation
        let validSelection = selection;
        if (selection.start !== null && selection.end !== null && selection.start > selection.end) {
             // Swap if start is after end
             validSelection = { start: selection.end, end: selection.start };
        } else if (selection.start !== null && selection.start === selection.end) {
             // Treat zero-duration selection as no selection for editing purposes
             // Keep it for potential seeking logic on mouse up? No, handleSeek does that.
             // validSelection = { start: null, end: null };
        }

        // Only update state if the validated selection actually changed
        if (validSelection.start !== this.state.selection.start || validSelection.end !== this.state.selection.end) {
             this.setState({ selection: validSelection });
             this.dispatchEvent(new CustomEvent<AudioEditorEvent>('selectionchanged', {
                 detail: { type: 'selectionchanged', payload: validSelection }
             }));
        }
    }

     private handleSeek(time: number): void {
         if (!this.state.audioBuffer || this.state.isRecording) return;
         const seekPosition = clamp(time, 0, this.state.totalDuration);
         const wasPlaying = this.state.isPlaying;

         // Stop current playback source *without* resetting the desired position
         this.audioManager.stopPlaybackInternal(false);
         this.stopPlaybackTimer(); // Stop UI timer

         // Set the new position
         this.setState({ currentPosition: seekPosition, isPlaying: false });

         // Emit position change event
          this.dispatchEvent(new CustomEvent<AudioEditorEvent>('positionchanged', {
             detail: { type: 'positionchanged', payload: { position: seekPosition } }
         }));

         // If it was playing before the seek, resume playback from the new position
         if (wasPlaying) {
             this.play();
         } else {
             // Manually re-render to ensure playhead updates correctly even when paused
             this.render();
         }
     }

    private handlePlaybackEnded(): void {
        // This is called by AudioBufferSourceNode.onended or when reaching end of selection
        if (this.state.isPlaying) { // Only process if state thought it was playing
            this.stopPlaybackTimer();
            let nextPosition = this.state.currentPosition; // Keep current position by default

             // Determine where playback stopped based on conditions
             const bufferEnd = this.state.totalDuration;
             const selectionEnd = this.state.selection.end;

             if (this.state.playSelectionOnly && !this.state.loopPlayback && selectionEnd !== null) {
                  // If playing selection (no loop), stop at selection end
                  nextPosition = selectionEnd;
             } else if (!this.state.loopPlayback) {
                  // If playing whole buffer (no loop), stop at buffer end
                   nextPosition = bufferEnd;
             }
             // If looping, position is handled by getCurrentPlaybackPosition, just update state

             // Ensure position doesn't exceed duration
             nextPosition = clamp(nextPosition, 0, bufferEnd);

            this.setState({ isPlaying: false, currentPosition: nextPosition });
            this.dispatchEvent(new CustomEvent<AudioEditorEvent>('playstatechanged', {
                detail: { type: 'playstatechanged', payload: { isPlaying: false } }
            }));
             // Ensure UI updates with final position
             this.render();
        }
    }

     private handleKeyDown(event: KeyboardEvent): void {
        // Ignore keys if an input element has focus within the editor
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        // Basic shortcuts (add Ctrl/Cmd modifier checks)
        const isCtrl = event.ctrlKey || event.metaKey; // Ctrl on Win/Linux, Cmd on Mac
        const key = event.key.toUpperCase();

        let handled = false;
         switch (key) {
             case ' ': // Spacebar
                this.togglePlayPause();
                handled = true;
                break;
             case 'ESCAPE': // Esc
                this.stop(true); // Stop and reset position
                handled = true;
                break;
             case 'DELETE': // Delete/Backspace
             case 'BACKSPACE':
                 if (this.state.selection.start !== null && this.state.selection.end !== null) {
                     this.deleteSelection();
                     handled = true;
                 }
                 break;
             case 'X': // Cut
                 if (isCtrl) {
                     this.cut();
                     handled = true;
                 }
                 break;
             case 'C': // Copy
                 if (isCtrl) {
                     this.copy();
                     handled = true;
                 }
                 break;
             case 'V': // Paste
                 if (isCtrl) {
                     this.paste();
                     handled = true;
                 }
                 break;
             case 'Z': // Undo
                 if (isCtrl) {
                     this.undo();
                     handled = true;
                 }
                 break;
             case 'Y': // Redo
                 if (isCtrl) {
                     this.redo();
                     handled = true;
                 }
                 break;
             case 'R': // Record
                 // Avoid conflict if user is typing 'R' in an input field (already checked above)
                 this.toggleRecording();
                 handled = true;
                 break;
             // Add more shortcuts (Arrow keys for seeking?, +/- for zoom?)
         }

         if (handled) {
             event.preventDefault(); // Prevent default browser action (e.g., space scrolling)
             event.stopPropagation(); // Stop event from bubbling up
         }
     }

    // --- Playback Actions ---
     togglePlayPause(): void {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play(): void {
        if (this.state.isPlaying || !this.state.audioBuffer || this.state.isRecording || this.state.isLoading) return;
         // Resume audio context if needed (user interaction)
         if (this.audioManager.audioContext.state === 'suspended') {
             this.audioManager.audioContext.resume().then(() => {
                 this.audioManager.play(this.state.audioBuffer!, this.state, this.handlePlaybackEnded.bind(this));
             });
         } else {
             this.audioManager.play(this.state.audioBuffer, this.state, this.handlePlaybackEnded.bind(this));
         }
        this.setState({ isPlaying: true });
        this.startPlaybackTimer();
        this.dispatchEvent(new CustomEvent<AudioEditorEvent>('playstatechanged', {
             detail: { type: 'playstatechanged', payload: { isPlaying: true } }
        }));
    }

    pause(): void {
        if (!this.state.isPlaying || this.state.isRecording) return;
        // Get accurate position *before* stopping the timer/source
        const pausePosition = this.audioManager.pause(); // AudioManager now handles node stopping internally
        this.stopPlaybackTimer();
        this.setState({ isPlaying: false, currentPosition: pausePosition });
         this.dispatchEvent(new CustomEvent<AudioEditorEvent>('playstatechanged', {
             detail: { type: 'playstatechanged', payload: { isPlaying: false } }
        }));
         // Ensure render updates playhead position correctly after pause
         this.render();
    }

    stop(resetPosition: boolean = true): void {
        if (this.state.isRecording) return; // Don't stop while recording, handle separately
        const wasPlaying = this.state.isPlaying;
        this.audioManager.stop(resetPosition); // Tell AudioManager whether to reset its internal offset
        this.stopPlaybackTimer();

        let finalPosition = this.state.currentPosition;
        if (resetPosition) {
             finalPosition = 0;
        } else if (this.state.playSelectionOnly && this.state.selection.start !== null) {
            // If stopping selection playback without reset, go to selection start
            finalPosition = this.state.selection.start;
        }
        // If not resetting and not playing selection, keep the current position (handled by AudioManager.stop)
         finalPosition = this.audioManager.getCurrentPlaybackPosition(this.state.totalDuration);


        this.setState({
             isPlaying: false,
             // Update position based on reset flag and AudioManager state
             currentPosition: finalPosition
        });

        if (wasPlaying) {
            this.dispatchEvent(new CustomEvent<AudioEditorEvent>('playstatechanged', {
                detail: { type: 'playstatechanged', payload: { isPlaying: false } }
            }));
        }
        // Manually trigger UI update for position if needed
         this.render();
    }

    // --- Playback Timer ---
    private startPlaybackTimer(): void {
        this.stopPlaybackTimer(); // Ensure no duplicates
        const update = () => {
            // Check isPlaying state directly
            if (!this.state.isPlaying || !this.state.audioBuffer) {
                this.stopPlaybackTimer(); // Stop if no longer playing or buffer gone
                return;
            }
            const currentPosition = this.audioManager.getCurrentPlaybackPosition(this.state.totalDuration);
            // Update state only if position changed noticeably
            if (Math.abs(currentPosition - this.state.currentPosition) > 0.01) { // Threshold to avoid excessive updates
                this.setState({ currentPosition: currentPosition }); // This will trigger render
                 this.dispatchEvent(new CustomEvent<AudioEditorEvent>('positionchanged', {
                    detail: { type: 'positionchanged', payload: { position: currentPosition } }
                }));
            } else {
                 // Still need to request next frame even if state didn't change
                 this.animationFrameId = requestAnimationFrame(update);
            }
        };
        this.animationFrameId = requestAnimationFrame(update);
    }

    private stopPlaybackTimer(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    // --- Editing Actions ---
    private updateBuffer(newBuffer: AudioBuffer | null, actionName: string) {
         if (newBuffer) {
             // Add to history BEFORE updating state
             // this.historyManager.addState(newBuffer);
             this.setState({
                 audioBuffer: newBuffer,
                 totalDuration: newBuffer.duration,
                 // Reset selection after edit? Optional.
                 selection: { start: null, end: null },
                 // Update undo/redo state
                 // canUndo: this.historyManager.canUndo(),
                 // canRedo: this.historyManager.canRedo(),
             });
             console.log(`${actionName} successful.`);
         } else {
             console.warn(`${actionName} failed or produced no result.`);
             // Optionally show an error message to the user
         }
     }

    cut() {
        if (!this.state.audioBuffer || !this.state.selection.start || !this.state.selection.end || this.state.isRecording || this.state.isLoading) return;
        console.log("Performing Cut...");
        const result = this.audioManager.cut(this.state.audioBuffer, this.state.selection);
        if (result) {
            this.setState({ clipboardBuffer: result.cutPart }); // Store cut part in clipboard
            this.updateBuffer(result.newBuffer, 'Cut');
        }
    }
    copy() {
         if (!this.state.audioBuffer || !this.state.selection.start || !this.state.selection.end || this.state.isRecording || this.state.isLoading) return;
         console.log("Performing Copy...");
         const copiedPart = this.audioManager.copy(this.state.audioBuffer, this.state.selection);
         if (copiedPart) {
             this.setState({ clipboardBuffer: copiedPart });
             console.log("Copy successful.");
             // Optionally provide visual feedback
         } else {
             console.warn("Copy failed.");
         }
    }
    paste() {
        if (!this.state.audioBuffer || !this.state.clipboardBuffer || this.state.isRecording || this.state.isLoading) return;
        console.log("Performing Paste...");
        // Paste at current playhead position or start of selection if exists
        const pastePosition = this.state.selection.start ?? this.state.currentPosition;
         const newBuffer = this.audioManager.paste(this.state.audioBuffer, this.state.clipboardBuffer, pastePosition);
         this.updateBuffer(newBuffer, 'Paste');
    }
    deleteSelection() {
        if (!this.state.audioBuffer || !this.state.selection.start || !this.state.selection.end || this.state.isRecording || this.state.isLoading) return;
        console.log("Performing Delete...");
        const newBuffer = this.audioManager.delete(this.state.audioBuffer, this.state.selection);
        this.updateBuffer(newBuffer, 'Delete');
    }
    undo() {
        console.warn("Undo not implemented");
        // if (this.state.isRecording || !this.historyManager.canUndo()) return;
        // const previousBuffer = this.historyManager.undo();
        // if (previousBuffer) {
        //     this.setState({
        //         audioBuffer: previousBuffer,
        //         totalDuration: previousBuffer.duration,
        //         selection: { start: null, end: null }, // Clear selection on undo?
        //         canUndo: this.historyManager.canUndo(),
        //         canRedo: this.historyManager.canRedo(),
        //     });
        // }
    }
    redo() {
        console.warn("Redo not implemented");
         // if (this.state.isRecording || !this.historyManager.canRedo()) return;
         // const nextBuffer = this.historyManager.redo();
         // if (nextBuffer) {
         //     this.setState({
         //         audioBuffer: nextBuffer,
         //         totalDuration: nextBuffer.duration,
         //         selection: { start: null, end: null },
         //         canUndo: this.historyManager.canUndo(),
         //         canRedo: this.historyManager.canRedo(),
         //     });
         // }
    }

    // --- Zoom Actions (Placeholders) ---
    zoomIn() { console.warn("Zoom In not implemented"); /* Affects peak generation/display scale */ }
    zoomOut() { console.warn("Zoom Out not implemented"); /* Affects peak generation/display scale */ }
    zoomToFit() { console.warn("Zoom To Fit not implemented"); /* Resets zoom level */ }

    // --- Recording Actions ---
    async toggleRecording(): Promise<void> {
         if (this.state.isLoading) return;

         if (this.state.isRecording) {
             // Stop Recording
             this.setState({ isLoading: true }); // Show loading while processing recording
             try {
                 const recordedBuffer = await this.audioManager.stopRecording();
                 this.setState({ isRecording: false, isLoading: false });
                 this.dispatchEvent(new CustomEvent<AudioEditorEvent>('recordingstatechanged', {
                     detail: { type: 'recordingstatechanged', payload: { isRecording: false } }
                 }));
                 if (recordedBuffer) {
                     // Replace current buffer with recording or merge? For now, replace.
                      this.setState({
                         audioBuffer: recordedBuffer,
                         totalDuration: recordedBuffer.duration,
                         fileName: "Recording",
                         currentPosition: 0,
                         selection: { start: null, end: null }
                     });
                     console.log("Recording finished and loaded.");
                 } else {
                     console.log("Recording stopped, no data.")
                 }
             } catch (error: any) {
                 console.error("Error stopping recording:", error);
                 this.setState({ isRecording: false, isLoading: false, error: error.message });
                 this.dispatchEvent(new CustomEvent<AudioEditorEvent>('error', {
                    detail: { type: 'error', payload: { message: `Failed to stop recording: ${error.message}` } }
                 }));
             }
         } else {
             // Start Recording
             this.stop(true); // Stop any playback
             this.setState({ // Clear previous audio immediately? Optional.
                 // audioBuffer: null,
                 // totalDuration: 0,
                 // fileName: "Preparing to record...",
                 // peaksData: null,
                 selection: { start: null, end: null },
                 currentPosition: 0,
             });
             try {
                 await this.audioManager.startRecording();
                 this.setState({ isRecording: true, fileName: "Recording..." });
                 this.dispatchEvent(new CustomEvent<AudioEditorEvent>('recordingstatechanged', {
                     detail: { type: 'recordingstatechanged', payload: { isRecording: true } }
                 }));
                 console.log("Recording started.");
             } catch (error: any) {
                  console.error("Failed to start recording:", error);
                  this.setState({ isRecording: false, error: error.message }); // Reset recording state on error
                  this.dispatchEvent(new CustomEvent<AudioEditorEvent>('error', {
                     detail: { type: 'error', payload: { message: `Failed to start recording: ${error.message}` } }
                  }));
             }
         }
     }


    // --- Rendering ---
    private render(prevState?: AudioEditorState): void {
        // Check if component exists before rendering
        this.topBar?.render(this.state);
        this.controlsBar?.render(this.state); // Assumes render method exists
        this.timeInfoDisplay?.render(this.state); // Assumes render method exists
        // Pass peaks data only if it's relevant (buffer exists)
        this.waveformDisplay?.render(this.state, this.state.audioBuffer ? this.peaksData : undefined);
        this.playbackControls?.render(this.state); // Assumes render method exists

        // Note: Individual components should handle their internal DOM updates based on the state they receive.
        // The main render here just orchestrates calling the components' render methods.
        // Direct DOM manipulation here (like updating time displays) should ideally be moved
        // into the respective component's render method (e.g., TimeInfoDisplay.render).

        // --- Example: If TimeInfoDisplay isn't a full component yet ---
        /*
        const selectionDuration = (this.state.selection.end ?? 0) - (this.state.selection.start ?? 0);
        document.getElementById('selectionStart')!.textContent = formatTime(this.state.selection.start ?? 0);
        document.getElementById('selectionDuration')!.textContent = formatTime(selectionDuration > 0 ? selectionDuration : 0);
        document.getElementById('selectionEnd')!.textContent = formatTime(this.state.selection.end ?? 0);
        document.getElementById('currentPosition')!.textContent = formatTime(this.state.currentPosition);
        */
        // --- End Example ---
    }

    // Public method to load audio programmatically
    async loadAudio(source: File | string | ArrayBuffer | AudioBuffer): Promise<void> {
         if (this.state.isLoading || this.state.isRecording) return; // Prevent loading during critical states

        this.stop(true); // Stop current activity
        this.setState({ isLoading: true, fileName: "Loading...", audioBuffer: null, totalDuration: 0, currentPosition: 0, selection: {start: null, end: null}, peaksData: null });

        try {
            let buffer: AudioBuffer;
            let fileName: string = "Loaded Audio";

            if (source instanceof File) {
                const result = await this.audioManager.loadAudioFile(source);
                buffer = result.buffer;
                fileName = result.fileName;
            } else if (typeof source === 'string') { // URL
                fileName = source.substring(source.lastIndexOf('/') + 1) || "Audio URL";
                const response = await fetch(source);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                 if (this.audioManager.audioContext.state === 'suspended') { await this.audioManager.audioContext.resume(); }
                buffer = await this.audioManager.audioContext.decodeAudioData(arrayBuffer);
            } else if (source instanceof ArrayBuffer) {
                 fileName = "ArrayBuffer Audio";
                 if (this.audioManager.audioContext.state === 'suspended') { await this.audioManager.audioContext.resume(); }
                buffer = await this.audioManager.audioContext.decodeAudioData(source);
            } else if (source instanceof AudioBuffer) {
                 fileName = "AudioBuffer Object";
                buffer = source; // Already decoded
            } else {
                throw new Error("Unsupported audio source type");
            }

            // State update triggers peak generation
            this.setState({
                audioBuffer: buffer,
                fileName: fileName,
                totalDuration: buffer.duration,
                isLoading: false,
                currentPosition: 0, // Reset position
            });
            this.dispatchEvent(new CustomEvent<AudioEditorEvent>('audioloaded', {
                 detail: { type: 'audioloaded', payload: { fileName, duration: buffer.duration } }
            }));

        } catch (error: any) {
             console.error("Error loading audio programmatically:", error);
             this.setState({ isLoading: false, fileName: 'Error loading file', audioBuffer: null, totalDuration: 0, error: error.message });
              this.dispatchEvent(new CustomEvent<AudioEditorEvent>('error', {
                 detail: { type: 'error', payload: { message: `Failed to load audio: ${error.message}` } }
            }));
        }
    }


    // Cleanup
    destroy(): void {
        console.log("Destroying AudioEditor...");
        this.stop(true);
        this.stopPlaybackTimer();

        // Clean up components (e.g., remove observers, listeners)
        this.waveformDisplay?.destroy(); // Example - implement destroy in components
        // this.controlsBar?.destroy();
        // ... destroy other components

        // Stop and cleanup AudioManager
        this.audioManager?.destroy();

        // Remove any global listeners (like keydown) if added outside components
        // Assuming addListener from Component base class was used and returns cleanup:
        // Need a way to track listeners added directly in AudioEditor if not using Component base
        // Example: If handleKeyDown was added directly:
        // this.element.removeEventListener('keydown', this.handleKeyDown.bind(this));

        // Clear container content
        if (this.element.parentElement) { // Check if attached to DOM
             this.element.parentElement.innerHTML = '';
        } else {
             this.element.innerHTML = ''; // Clear element itself if detached
        }

         // Nullify references
         // (TypeScript might handle this with garbage collection, but explicit nulling can help)
         // this.topBar = null; // Requires type to be `TopBar | null`
         // ... nullify other components ...
         // this.audioManager = null;
         // this.peaksData = null;

        console.log("AudioEditor destroyed.");
    }
}
