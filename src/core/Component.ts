export abstract class Component<T extends HTMLElement = HTMLElement> {
    protected element: T;

    constructor(element: T) {
        this.element = element;
    }

    protected $<K extends keyof HTMLElementTagNameMap>(selector: K): HTMLElementTagNameMap[K] | null
    protected $<E extends Element = Element>(selector: string): E | null
    protected $<E extends Element = Element>(selector: string): E | null {
        return this.element.querySelector<E>(selector);
    }

    protected $$<K extends keyof HTMLElementTagNameMap>(selector: K): NodeListOf<HTMLElementTagNameMap[K]>
    protected $$<E extends Element = Element>(selector: string): NodeListOf<E>
    protected $$<E extends Element = Element>(selector: string): NodeListOf<E> {
        return this.element.querySelectorAll<E>(selector);
    }

    // Helper to add event listeners that can be easily removed
    protected addListener<K extends keyof HTMLElementEventMap>(
        target: EventTarget,
        type: K,
        listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
        options?: boolean | AddEventListenerOptions
    ): () => void {
        target.addEventListener(type, listener as EventListener, options);
        return () => target.removeEventListener(type, listener as EventListener, options);
    }

    // Abstract method to force components to implement rendering/update logic
    // Use a more specific state type if possible in inheriting classes
    abstract render(state: any, ...optionalArgs: any[]): void;
}