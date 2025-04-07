
/**
 * Formats time in seconds to MM:SS.mmm format.
 */
export function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) {
        return "00:00.000";
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((remainingSeconds - Math.floor(remainingSeconds)) * 1000);

    const minStr = String(minutes).padStart(2, '0');
    const secStr = String(Math.floor(remainingSeconds)).padStart(2, '0');
    const msStr = String(milliseconds).padStart(3, '0');

    return `${minStr}:${secStr}.${msStr}`;
}

/**
 * Debounce function to limit the rate at which a function can fire.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            func(...args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * Clamp a number between a min and max value.
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
}