export interface TimeData {
    start: number; // seconds
    end: number;   // seconds
    duration: number; // seconds
}

export interface SelectionRange {
    start: number | null; // seconds
    end: number | null;   // seconds
}

export interface AudioEditorState {
    fileName: string | null;
    audioBuffer: AudioBuffer | null;
    totalDuration: number; // seconds
    currentPosition: number; // seconds
    isPlaying: boolean;
    isRecording: boolean;
    isLoading: boolean;
    selection: SelectionRange;
    zoomLevel: number; // Example: 1 = 100%
    canUndo: boolean;
    canRedo: boolean;
    clipboardBuffer: AudioBuffer | null; // For copy/paste
    playSelectionOnly: boolean;
    loopPlayback: boolean;
}

// Events that the main component might emit
export type AudioEditorEvent =
    | { type: 'audioloaded'; payload: { fileName: string; duration: number } }
    | { type: 'playstatechanged'; payload: { isPlaying: boolean } }
    | { type: 'selectionchanged'; payload: SelectionRange }
    | { type: 'positionchanged'; payload: { position: number } }
    | { type: 'error'; payload: { message: string } }
    | { type: 'recordingstatechanged'; payload: { isRecording: boolean } };