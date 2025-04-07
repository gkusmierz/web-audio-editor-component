// Basic structure - Needs significant implementation for real functionality
import { AudioEditorState, SelectionRange } from '../types';

export class AudioManager {
    public audioContext: AudioContext; // Make public for potential direct access (e.g., loading from URL)
    private sourceNode: AudioBufferSourceNode | null = null;
    private gainNode: GainNode;
    private startTime: number = 0; // AudioContext time when playback started/resumed
    private startOffset: number = 0; // Position within the buffer where playback started/resumed

    // For Recording (Placeholders)
    private mediaStream: MediaStream | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];

    constructor() {
        // Handle vendor prefixes for older browsers if necessary
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) {
             throw new Error("Web Audio API is not supported in this browser.");
        }
        this.audioContext = new AudioContext();
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(this.audioContext.destination);
    }

    get currentTime(): number {
        return this.audioContext.currentTime;
    }

    async loadAudioFile(file: File): Promise<{ buffer: AudioBuffer; fileName: string }> {
         // Resume context if suspended (often required after user interaction)
         if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
         }
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const arrayBuffer = e.target?.result as ArrayBuffer;
                if (!arrayBuffer) {
                    return reject(new Error("Failed to read file buffer."));
                }
                this.audioContext.decodeAudioData(
                    arrayBuffer,
                    (buffer) => resolve({ buffer, fileName: file.name }),
                    // Use DOMException for better error details if possible
                    (error: DOMException | Error) => reject(new Error(`Error decoding audio data: ${error.message}`))
                );
            };
            reader.onerror = (e) => reject(new Error(`File reading error: ${reader.error?.message}`));
            reader.readAsArrayBuffer(file);
        });
    }

    play(buffer: AudioBuffer, state: AudioEditorState, onEnded: () => void): void {
        if (state.isPlaying || !buffer) return;
        // Resume context just before playing
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        this.stopPlaybackInternal(false); // Stop existing playback but don't reset position yet

        this.sourceNode = this.audioContext.createBufferSource();
        this.sourceNode.buffer = buffer;
        this.sourceNode.connect(this.gainNode);
        this.sourceNode.loop = state.loopPlayback;

        let playStart = state.currentPosition;
        let duration: number | undefined = undefined;

        if (state.playSelectionOnly && state.selection.start !== null && state.selection.end !== null) {
             // Ensure playback starts within the selection if currentPosition is outside
            playStart = Math.max(state.selection.start, Math.min(state.currentPosition, state.selection.end));
            // If starting before selection, jump to selection start
             if (state.currentPosition < state.selection.start) {
                 playStart = state.selection.start;
             }
             // If starting after selection end, jump to selection start (for selection playback)
              if (state.currentPosition >= state.selection.end) {
                 playStart = state.selection.start;
             }

            duration = state.selection.end - playStart; // Duration from the adjusted start point
            if (duration <= 0) return; // Nothing to play from this point in selection

            if (state.loopPlayback) {
                 this.sourceNode.loopStart = state.selection.start;
                 this.sourceNode.loopEnd = state.selection.end;
                 // Adjust duration if looping within selection, play full loop segment
                 duration = state.selection.end - state.selection.start;
                 playStart = state.selection.start + (playStart - state.selection.start) % duration; // Wrap start offset within loop
            }
        } else if (state.loopPlayback) {
             this.sourceNode.loopStart = 0;
             this.sourceNode.loopEnd = buffer.duration;
        }

        this.startOffset = playStart;
        this.startTime = this.audioContext.currentTime;

        this.sourceNode.onended = () => {
             // Check if the sourceNode that ended is the currently active one
             // And if the context is still running (wasn't stopped/paused manually)
             if (this.sourceNode && this.sourceNode.onended) {
                // Prevent calling onEnded multiple times if stop was called nearly simultaneously
                this.sourceNode.onended = null;
                onEnded();
             }
        };

        try {
            if (duration !== undefined && !this.sourceNode.loop) { // Don't use duration with loop=true for selection loops
                 this.sourceNode.start(0, this.startOffset, duration);
            } else {
                this.sourceNode.start(0, this.startOffset); // Start from offset, play till end or loop
            }
        } catch (e: any) {
             console.error("Error starting playback:", e);
             // Potentially reset state or notify user
        }
    }

    pause(): number { // Returns the position at which it was paused
        if (!this.sourceNode || this.audioContext.state !== 'running') {
            return this.startOffset; // Return last known offset if not running
        }

        // Calculate elapsed time accurately before suspending
        const elapsedTime = this.audioContext.currentTime - this.startTime;
        this.startOffset += elapsedTime; // Update offset first

        // Use suspend for pausing
        this.audioContext.suspend();

        // Adjust for buffer duration if needed (especially with looping)
        if (this.sourceNode.buffer) {
            let duration = this.sourceNode.buffer.duration;
            if (this.sourceNode.loop) {
                 duration = (this.sourceNode.loopEnd || duration) - (this.sourceNode.loopStart || 0);
                 if (duration > 0) {
                      this.startOffset = (this.sourceNode.loopStart || 0) + (this.startOffset - (this.sourceNode.loopStart || 0)) % duration;
                 } else {
                      this.startOffset = this.startOffset % this.sourceNode.buffer.duration; // Fallback
                 }
            } else {
                 this.startOffset = this.startOffset % duration;
            }
        }

        // Clean up the source node AFTER calculating position and suspending
        // This prevents the 'onended' callback from firing inappropriately on pause.
        if (this.sourceNode) {
            this.sourceNode.onended = null; // Remove listener before stopping
            try {
                this.sourceNode.stop(); // Stop node after context suspend and state calculation
            } catch(e) { /* Ignore if already stopped */ }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }


        return this.startOffset;
    }


    /** Stops playback and optionally resets the playhead position */
    stop(resetPosition: boolean = true): void {
       this.stopPlaybackInternal(resetPosition);
    }

    /** Internal method to stop playback source */
    private stopPlaybackInternal(resetPosition: boolean): void {
        if (this.sourceNode) {
            this.sourceNode.onended = null; // Prevent ended callback on manual stop
            try {
                this.sourceNode.stop();
            } catch (e) {
                // Ignore errors if already stopped (InvalidStateError)
                if (!(e instanceof DOMException && e.name === 'InvalidStateError')) {
                    console.warn("Error stopping source node:", e);
                }
            }
            this.sourceNode.disconnect();
            this.sourceNode = null;
        }
        // Resume context if it was suspended (e.g., by pause)
         if (this.audioContext.state === 'suspended') {
            this.audioContext.resume(); // No need to wait for promise here
        }
         if (resetPosition) {
             this.startOffset = 0; // Reset playback offset
         }
         // Always reset the audio context start time reference on stop
         this.startTime = this.audioContext.currentTime;
    }


    getCurrentPlaybackPosition(bufferDuration: number): number {
        if (!this.sourceNode || this.audioContext.state !== 'running' || !bufferDuration) {
            // Return the stored offset if paused, stopped, or no buffer
             // Ensure startOffset doesn't exceed duration (can happen with rounding/timing)
            return Math.max(0, Math.min(this.startOffset, bufferDuration || 0));
        }

        const elapsedTime = this.audioContext.currentTime - this.startTime;
        let currentPos = this.startOffset + elapsedTime;

        // Handle looping - wrap around based on loop points
        if (this.sourceNode.loop) {
            const loopStart = this.sourceNode.loopStart ?? 0;
            const loopEnd = this.sourceNode.loopEnd ?? bufferDuration;
            const loopDuration = loopEnd - loopStart;
            if (loopDuration > 0 && currentPos >= loopEnd) {
                // Calculate how many loops have passed and the position within the current loop cycle
                currentPos = loopStart + ((currentPos - loopStart) % loopDuration);
            }
        }

        // Clamp to buffer duration boundary
        return Math.max(0, Math.min(currentPos, bufferDuration));
    }

    // --- Placeholder Methods for Editing ---
    cut(buffer: AudioBuffer, selection: SelectionRange): { newBuffer: AudioBuffer, cutPart: AudioBuffer } | null {
        console.warn("AudioManager.cut not implemented");
        // Implementation details:
        // 1. Validate selection.
        // 2. Calculate frame counts for start/end based on sampleRate.
        // 3. Create the 'cutPart' AudioBuffer: allocate, copy data from selection range.
        // 4. Create the 'newBuffer': allocate size (original - selection), copy data before selection, copy data after selection.
        // 5. Return both buffers.
        return null; // Replace with actual implementation
    }

    copy(buffer: AudioBuffer, selection: SelectionRange): AudioBuffer | null {
        console.warn("AudioManager.copy not implemented");
        // Implementation details:
        // 1. Validate selection.
        // 2. Calculate frame counts.
        // 3. Create new AudioBuffer for the copy: allocate size (selection duration), copy data from selection range.
        // 4. Return the new buffer.
        return null; // Replace with actual implementation
    }

    paste(originalBuffer: AudioBuffer, pasteBuffer: AudioBuffer, position: number): AudioBuffer | null {
        console.warn("AudioManager.paste not implemented");
        // Implementation details:
        // 1. Validate position.
        // 2. Calculate frame counts.
        // 3. Create the 'newBuffer': allocate size (original + pasteBuffer),
        // 4. Copy data from original up to insertion point.
        // 5. Copy data from pasteBuffer.
        // 6. Copy remaining data from original after insertion point.
        // 7. Return the new buffer.
        return null; // Replace with actual implementation
    }

    delete(buffer: AudioBuffer, selection: SelectionRange): AudioBuffer | null {
        console.warn("AudioManager.delete not implemented");
        // Similar logic to 'cut', but only returns the buffer *without* the selection.
        return null; // Replace with actual implementation
    }

     // --- Basic Recording ---
    async startRecording(deviceId?: string): Promise<void> {
        console.log("Attempting to start recording...");
        if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
            console.warn("Recording is already in progress.");
            return;
        }
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        try {
            const constraints: MediaStreamConstraints = {
                audio: deviceId ? { deviceId: { exact: deviceId } } : true,
                video: false
            };
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            console.log("Microphone access granted.");

            this.recordedChunks = []; // Reset chunks

            // Check supported MIME types
             const options = { mimeType: 'audio/webm;codecs=opus' }; // Prefer webm/opus
             if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                 console.warn(`${options.mimeType} not supported, trying default.`);
                 delete (options as any).mimeType; // Use browser default
             }

            this.mediaRecorder = new MediaRecorder(this.mediaStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                    console.log(`Recorded chunk size: ${event.data.size}`);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log("MediaRecorder stopped.");
                // Stream tracks are stopped automatically when recorder stops
                this.mediaStream?.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
                this.mediaRecorder = null;
            };

            this.mediaRecorder.onerror = (event) => {
                console.error("MediaRecorder error:", event);
                 // Clean up tracks if an error occurs
                 this.mediaStream?.getTracks().forEach(track => track.stop());
                 this.mediaStream = null;
                 this.mediaRecorder = null;
                 // Potentially throw or handle the error further up
            };


            this.mediaRecorder.start();
            console.log("MediaRecorder started, state:", this.mediaRecorder.state);

        } catch (err: any) {
            console.error("Error accessing microphone:", err.name, err.message);
             // Clean up any partial stream
             if (this.mediaStream) {
                this.mediaStream.getTracks().forEach(track => track.stop());
                this.mediaStream = null;
             }
            throw new Error(`Could not start recording: ${err.message}`); // Re-throw for handling in UI
        }
    }

    async stopRecording(): Promise<AudioBuffer | null> {
        console.log("Attempting to stop recording...");
        return new Promise(async (resolve, reject) => {
            if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
                console.warn("Recording not active or already stopped.");
                return resolve(null); // Nothing to return
            }

             // Setup a one-time listener for the 'stop' event *before* calling stop()
             this.mediaRecorder.onstop = async () => {
                 console.log("MediaRecorder stop event fired. Processing data...");
                 this.mediaStream?.getTracks().forEach(track => track.stop()); // Ensure tracks are stopped
                 this.mediaStream = null;
                 this.mediaRecorder = null; // Clear recorder reference

                 if (this.recordedChunks.length === 0) {
                     console.warn("No recorded data chunks found.");
                     return resolve(null);
                 }

                 try {
                     const blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'audio/webm' });
                     console.log(`Combined blob size: ${blob.size}, type: ${blob.type}`);
                     this.recordedChunks = []; // Clear chunks immediately after creating blob

                     const arrayBuffer = await blob.arrayBuffer();
                     if (this.audioContext.state === 'suspended') {
                         await this.audioContext.resume();
                     }
                     // Decode the audio data from the blob
                     this.audioContext.decodeAudioData(
                         arrayBuffer,
                         (buffer) => {
                             console.log("Recorded audio decoded successfully.");
                             resolve(buffer);
                         },
                         (error: DOMException | Error) => {
                             console.error("Error decoding recorded audio:", error);
                             reject(new Error(`Failed to decode recording: ${error.message}`));
                         }
                     );
                 } catch (error: any) {
                     console.error("Error processing recording blob:", error);
                     this.recordedChunks = []; // Clear chunks even on error
                     reject(new Error(`Failed to process recording: ${error.message}`));
                 }
             };

              // Now, request the recorder to stop
             this.mediaRecorder.stop();
             console.log("mediaRecorder.stop() called.");
        });
    }

    get isContextRunning(): boolean {
        return this.audioContext.state === 'running';
    }

    // --- Basic Waveform Data Generation ---
    /**
     * Generates peak data for waveform visualization.
     * Returns an array of arrays (one for each channel), where each inner array
     * contains alternating min/max peak values for each "pixel" or segment.
     */
    getPeaks(buffer: AudioBuffer, targetWidth: number): number[][] {
         if (!buffer) return [];

         const numChannels = buffer.numberOfChannels;
         const peaks: number[][] = Array.from({ length: numChannels }, () => new Array(targetWidth * 2).fill(0)); // Store min/max for each segment
         const channelData: Float32Array[] = [];
         for (let i = 0; i < numChannels; i++) {
             channelData.push(buffer.getChannelData(i));
         }

         const totalSamples = buffer.length;
         const samplesPerPixel = Math.floor(totalSamples / targetWidth);

         if (samplesPerPixel <= 0) {
              console.warn("Not enough samples for the target width, returning simplified peaks.");
              // Handle very short audio / very wide display - just sample directly?
               const step = Math.max(1, Math.floor(totalSamples / targetWidth));
               for (let c = 0; c < numChannels; c++) {
                 for (let i = 0; i < targetWidth; i++) {
                   const sampleIndex = Math.min(Math.floor(i * step), totalSamples - 1);
                   const sample = channelData[c][sampleIndex] || 0;
                   peaks[c][i * 2] = sample;     // min
                   peaks[c][i * 2 + 1] = sample; // max
                 }
               }
               return peaks;
         }


         for (let c = 0; c < numChannels; c++) {
             const data = channelData[c];
             for (let i = 0; i < targetWidth; i++) {
                 const segmentStart = i * samplesPerPixel;
                 // Ensure segmentEnd doesn't exceed buffer length
                 const segmentEnd = Math.min(segmentStart + samplesPerPixel, totalSamples);

                 let min = 1.0;
                 let max = -1.0;

                 // Find min and max in this segment
                 for (let j = segmentStart; j < segmentEnd; j++) {
                     const sample = data[j];
                     if (sample < min) {
                         min = sample;
                     }
                     if (sample > max) {
                         max = sample;
                     }
                 }
                 // Store min and max for this pixel/segment
                 peaks[c][i * 2] = min;
                 peaks[c][i * 2 + 1] = max;
             }
         }

         return peaks;
     }


    destroy(): void {
        this.stop(true); // Stop playback and reset position
        // Stop any active recording
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop(); // This will also stop tracks via the onstop handler
        } else {
             // If not recording, ensure any lingering stream is stopped
             this.mediaStream?.getTracks().forEach(track => track.stop());
        }
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];

        // Close the AudioContext
        this.audioContext.close()
            .then(() => console.log("AudioContext closed successfully."))
            .catch(e => console.error("Error closing AudioContext:", e));
    }
}