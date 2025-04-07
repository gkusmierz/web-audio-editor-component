# Web Audio Editor Component

A reusable web component for basic audio editing visualization, playback, and recording, built with TypeScript.

**Note:** This is currently a structural component. Core audio editing features (cut, copy, paste, delete, complex waveform drawing, undo/redo, recording) require significant implementation within the `AudioManager` and component interaction logic.

## Installation

```bash
npm install web-audio-editor-component
# or
yarn add web-audio-editor-component
```

## Usage

1.  **Include CSS:** Link the provided stylesheet in your HTML's `<head>` section.

    ```html
    <link rel="stylesheet" href="node_modules/web-audio-editor-component/styles.css">
    ```
    *(Adjust the path based on your project setup)*

2.  **Create a Container:** Add a `div` element in your HTML where you want the editor to appear.

    ```html
    <div id="audio-editor-container"></div>
    ```

3.  **Initialize in JavaScript:**

    ```javascript
    import { createAudioEditor, AudioEditor } from 'web-audio-editor-component';
    // Or if using CommonJS:
    // const { createAudioEditor } = require('web-audio-editor-component');

    // Create the editor instance
    const editorElement = document.getElementById('audio-editor-container');
    if (editorElement) {
        const editor = createAudioEditor('audio-editor-container');

        // --- Optional: Interact with the editor ---

        // Load an audio file programmatically (e.g., from a URL)
        // editor.loadAudio('path/to/your/audio.mp3');

        // Listen to events
        editor.addEventListener('audioloaded', (event) => {
            // Use type assertion if needed or check event.detail.type
            const detail = (event as CustomEvent).detail;
            if (detail.type === 'audioloaded') {
                console.log(`Audio loaded: ${detail.payload.fileName}, Duration: ${detail.payload.duration}`);
            }
        });

         editor.addEventListener('playstatechanged', (event) => {
             const detail = (event as CustomEvent).detail;
             if (detail.type === 'playstatechanged') {
                 console.log(`Playback state changed: ${detail.payload.isPlaying ? 'Playing' : 'Paused/Stopped'}`);
             }
         });

        editor.addEventListener('error', (event) => {
             const detail = (event as CustomEvent).detail;
             if (detail.type === 'error') {
                 console.error(`Editor Error: ${detail.payload.message}`);
                 // Display error to the user
             }
        });

        // Example: Clean up when done (e.g., in a SPA component unmount)
        // window.addEventListener('beforeunload', () => {
        //     editor.destroy();
        // });

    } else {
        console.error("Container element for audio editor not found.");
    }
    ```

## API (Basic)

*   `createAudioEditor(containerId: string): AudioEditor`
    *   Initializes the editor within the specified container element ID.
*   `editor.loadAudio(source: File | string): Promise<void>`
    *   Loads audio from a `File` object or a URL string.
*   `editor.play(): void`
*   `editor.pause(): void`
*   `editor.stop(): void`
*   `editor.destroy(): void`
    *   Cleans up resources and removes the editor from the DOM.
*   **Events:** (Listen using `editor.addEventListener(eventName, callback)`)
    *   `audioloaded`: Fired when audio is successfully loaded. `event.detail.payload: { fileName: string; duration: number }`
    *   `playstatechanged`: Fired when playback starts or stops/pauses. `event.detail.payload: { isPlaying: boolean }`
    *   `selectionchanged`: Fired when the selection area changes. `event.detail.payload: SelectionRange`
    *   `positionchanged`: Fired frequently during playback. `event.detail.payload: { position: number }`
    *   `error`: Fired on loading or processing errors. `event.detail.payload: { message: string }`
    *   `recordingstatechanged`: (To be implemented) Fired when recording starts/stops.

## Development

1.  Clone the repository (or create files manually from the provided content).
2.  Install dependencies: `npm install`
3.  Build: `npm run build`
4.  Watch for changes (using esbuild for simple bundling): `npm run dev` (You'll need an HTML file to test `dist/bundle.js`)

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT