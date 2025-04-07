import { createAudioEditor } from './src/index.ts'; // Import directly from source

// Get the container element
const editorContainerId = 'audio-editor-container';
const editorElement = document.getElementById(editorContainerId);

if (editorElement) {
    console.log(`Found container: #${editorContainerId}. Initializing editor...`);
    try {
        // Create the editor instance
        const editor = createAudioEditor(editorContainerId);
        console.log('Audio editor instance created.');

        // --- Optional: Add basic event listeners for demonstration ---

        editor.addEventListener('audioloaded', (event) => {
            const detail = event.detail;
            if (detail.type === 'audioloaded') {
                console.log(`DEMO: Audio loaded: ${detail.payload.fileName}, Duration: ${detail.payload.duration}s`);
                alert(`Audio loaded: ${detail.payload.fileName}\nDuration: ${detail.payload.duration.toFixed(2)}s`);
            }
        });

        editor.addEventListener('playstatechanged', (event) => {
            const detail = event.detail;
            if (detail.type === 'playstatechanged') {
                console.log(`DEMO: Playback state changed: ${detail.payload.isPlaying ? 'Playing' : 'Paused/Stopped'}`);
            }
        });

         editor.addEventListener('positionchanged', (event) => {
            const detail = event.detail;
            if (detail.type === 'positionchanged') {
                // Avoid excessive logging; maybe log every second?
                // console.log(`DEMO: Position changed: ${detail.payload.position.toFixed(2)}s`);
            }
        });

        editor.addEventListener('error', (event) => {
             const detail = event.detail;
             if (detail.type === 'error') {
                 console.error(`DEMO: Editor Error: ${detail.payload.message}`);
                 alert(`Editor Error: ${detail.payload.message}`);
             }
        });

        // You might want to load a default audio file here for testing, if available
        // Example: editor.loadAudio('path/to/your/audio.mp3');
        // Since we don't have a sample audio file in the project,
        // the user will need to use the "Load Audio" button within the component.

        console.log('Event listeners added. Editor setup complete.');

        // Optional: Expose editor to window for debugging
        // window.audioEditor = editor;

    } catch (error) {
        console.error("Failed to initialize audio editor:", error);
        editorElement.innerHTML = `<p style="color: red;">Error initializing audio editor. Check console.</p>`;
    }

} else {
    console.error(`Container element '#${editorContainerId}' not found.`);
    alert(`Error: Could not find the container element '#${editorContainerId}' in the HTML.`);
}