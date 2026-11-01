/** Returns the Backend base URL with exactly one trailing slash, without api/. */
export function getApiBaseUrl(): string {
    const source = import.meta.env.DEV
        ? "VITE_API_BASE_URL"
        : "config.js: API_BASE_URL";
    const value: unknown = import.meta.env.DEV
        ? import.meta.env.VITE_API_BASE_URL
        : window.__APP_CONFIG__?.API_BASE_URL;

    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`Missing API base URL setting: ${source}`);
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        throw new Error(`Invalid API base URL setting: ${source}. Expected an absolute HTTP(S) URL.`);
    }

    if (
        !/^https?:\/\//i.test(value) ||
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        !url.hostname ||
        url.username ||
        url.password ||
        value.includes("?") ||
        value.includes("#") ||
        /\s|\\/.test(value)
    ) {
        throw new Error(
            `Invalid API base URL setting: ${source}. Expected an absolute HTTP(S) URL without credentials, query, fragment, whitespace or backslashes.`,
        );
    }

    url.pathname = url.pathname.replace(/\/+$/, "") + "/";
    return url.href;
}
