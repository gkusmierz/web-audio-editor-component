import { AudioEditor } from './components/AudioEditor';
import { AudioEditorState, AudioEditorEvent, SelectionRange, TimeData } from './types';
import { formatTime } from './core/Utils';

// Export the main class and potentially relevant types/utils
export {
    AudioEditor,
    AudioEditorState,
    AudioEditorEvent,
    SelectionRange,
    TimeData,
    formatTime
};

// Define the function to easily initialize the editor using the provided HTML structure.
// Ensure the HTML includes elements with IDs used by the components.
export function createAudioEditor(containerId: string): AudioEditor {
    const initialHtml = `
    <div class="audio-editor" tabindex="-1"> <!-- Added tabindex -->
        <!-- Top Bar: File Info -->
        <div class="top-bar">
             <div class="file-info">
                 <label for="audioFileInput" id="loadButtonLabel" title="Load Audio File">
                     <span class="icon">📁</span> Load File
                 </label>
                 <!-- IMPORTANT: Keep input outside label or use unique ID and 'for' -->
                 <input type="file" id="audioFileInput" accept="audio/*" style="display: none;">
                 <span class="file-name" id="fileName">No file loaded</span>
            </div>
            <span class="duration-display" id="totalDuration">Total: 00:00.000</span>
        </div>

        <!-- Controls Bar: Editing Tools -->
        <div class="controls-bar">
            <div class="control-group">
                <button id="zoomInButton" title="Zoom In (+)" class="icon-only" disabled><span class="icon">➕</span></button>
                <button id="zoomOutButton" title="Zoom Out (-)" class="icon-only" disabled><span class="icon">➖</span></button>
                <button id="zoomFitButton" title="Zoom to Fit" class="icon-only" disabled><span class="icon">↔️</span></button>
            </div>
            <div class="control-group">
                <button id="cutButton" title="Cut Selection (Ctrl+X)" disabled><span class="icon">✂️</span> Cut</button>
                <button id="copyButton" title="Copy Selection (Ctrl+C)" disabled><span class="icon">📋</span> Copy</button>
                <button id="pasteButton" title="Paste (Ctrl+V)" disabled><span class="icon">💾</span> Paste</button> <!-- Consider paste icon? -->
                <button id="deleteButton" title="Delete Selection (Del)" disabled><span class="icon">🗑️</span> Delete</button>
            </div>
            <div class="control-group">
                <button id="recordButton" title="Record from Microphone (R)"><span class="icon">🎤</span> Record</button>
            </div>
             <div class="control-group">
                 <button id="undoButton" title="Undo (Ctrl+Z)" class="icon-only" disabled><span class="icon">↩️</span></button>
                 <button id="redoButton" title="Redo (Ctrl+Y)" class="icon-only" disabled><span class="icon">↪️</span></button>
             </div>
        </div>

        <!-- Time Info Display -->
        <div class="time-info">
            <span class="start">
                <span class="label">Start</span>
                <span class="time-value" id="selectionStart">00:00.000</span>
            </span>
            <span class="duration">
                <span class="label">Duration</span>
                <span class="time-value" id="selectionDuration">00:00.000</span>
             </span>
            <span class="end">
                 <span class="label">End</span>
                <span class="time-value" id="selectionEnd">00:00.000</span>
            </span>
        </div>

        <!-- Waveform Display -->
        <div class="waveform-container" id="waveformContainer">
            <canvas id="waveformCanvas"></canvas>
            <div class="selection-overlay" id="selectionOverlay" style="display: none;"></div>
            <div class="playhead" id="playhead" style="display: none;"></div>
            <div id="loadingIndicator" style="display: none;">Loading...</div>
            <div id="recordingIndicator" style="display: none;">Recording...</div>
        </div>

        <!-- Playback Controls -->
        <div class="playback-controls">
            <div class="playback-buttons">
                <button id="playPauseButton" title="Play (Space)" disabled>
                    <span class="play-icon">▶</span>
                    <span class="pause-icon" style="display: none;">❚❚</span>
                </button>
                <button id="stopButton" title="Stop (Esc)" class="icon-only" disabled><span class="icon">⏹️</span></button>
            </div>
             <div class="playback-options">
                 <label>
                     <input type="checkbox" id="playSelectionCheckbox"> Play Selection Only
                 </label>
                 <label>
                     <input type="checkbox" id="loopCheckbox"> Loop
                 </label>
             </div>
            <span class="position-display" id="currentPosition">00:00.000</span>
        </div>
    </div>
    `;
    // Instantiate the editor using the container ID and the HTML string
    return new AudioEditor(containerId, initialHtml);
}