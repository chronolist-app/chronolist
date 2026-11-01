let message: string | null = null;
const listeners = new Set<() => void>();

export function notifyApiNotice(next: string | null) {
    if (message === next) return;
    message = next;
    listeners.forEach((listener) => listener());
}

export function subscribeApiNotice(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

export const getApiNotice = () => message;
