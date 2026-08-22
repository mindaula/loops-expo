import { Storage } from '@/utils/cache';

/**
 * Builds media sources (video / image) for protected media endpoints.
 *
 * Protected media on our own instance is served by an authenticated route.
 * Native players (expo-video / ExoPlayer / AVPlayer) and expo-image support a
 * `headers` field on their source object, so the OAuth access token can travel
 * in the Authorization header instead of relying on the URL alone.
 *
 * SECURITY: the token is only ever attached when BOTH hold true:
 *
 *   1. the URL points at the instance the user is currently logged in to, and
 *   2. the URL uses https.
 *
 * Videos can be federated (`is_local: false`), in which case `src_url` points
 * at a foreign server. Attaching the header unconditionally would hand our
 * access token to that server. Requiring https prevents the token from being
 * sent over a plaintext connection.
 */

type MediaHeaders = Record<string, string>;

export type MediaSource = {
    uri: string;
    headers?: MediaHeaders;
};

/** Extracts the lowercased host (incl. port) from an absolute http(s) URL. */
function hostOf(url: string): string | null {
    const match = /^https?:\/\/([^/?#]+)/i.exec(url);

    return match ? match[1].toLowerCase() : null;
}

function isHttps(url: string): boolean {
    return /^https:\/\//i.test(url);
}

/**
 * Returns the Authorization header for `url`, or undefined when the token must
 * not be sent to that URL.
 */
export function mediaAuthHeaders(url?: string | null): MediaHeaders | undefined {
    if (!url || typeof url !== 'string') {
        return undefined;
    }

    const instance = Storage.getString('app.instance');
    const token = Storage.getString('app.token');

    if (!instance || !token) {
        return undefined;
    }

    // Never send the token over plaintext.
    if (!isHttps(url)) {
        return undefined;
    }

    // Never send the token to a server other than our own instance.
    if (hostOf(url) !== instance.toLowerCase()) {
        return undefined;
    }

    return { Authorization: `Bearer ${token}` };
}

/**
 * Wraps a media URL into a source object, adding the Authorization header when
 * the URL belongs to our instance. Returns null for empty input so callers can
 * keep rendering a placeholder.
 */
export function mediaSource(url?: string | null): MediaSource | null {
    if (!url || typeof url !== 'string') {
        return null;
    }

    const headers = mediaAuthHeaders(url);

    return headers ? { uri: url, headers } : { uri: url };
}
