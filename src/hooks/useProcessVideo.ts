import { File as FsFile } from 'expo-file-system';
import { Video } from 'react-native-compressor';

/**
 * Compresses a recorded or picked video before it is uploaded.
 *
 * `onProgress` receives whole percentages (0-100) so callers can render a
 * "Preparing… 42%" style label directly. The returned value is the path of the
 * file to upload; if compression is skipped or fails, the original path is
 * returned so the upload can still go ahead.
 */
/** Size of `path`, or 0 when it cannot be read. */
function sizeOf(path: string): number {
    try {
        const file = new FsFile(path.startsWith('file://') ? path : `file://${path}`);

        return file.exists ? (file.size ?? 0) : 0;
    } catch {
        return 0;
    }
}

/**
 * A compressed result is only trusted when it is a real file and did not lose
 * nearly all of its content. Legitimate compression saves a lot, but never
 * more than 99% -- anything smaller than that is a broken transcode.
 */
function isPlausibleVideo(compressed: string, original: string): boolean {
    const compressedSize = sizeOf(compressed);

    if (compressedSize < 1024) {
        return false;
    }

    const originalSize = sizeOf(original);

    return originalSize === 0 || compressedSize >= originalSize * 0.01;
}

export async function prepareVideoForUpload(
    uri: string,
    onProgress?: (percent: number) => void,
): Promise<string> {
    if (!uri) return uri;

    try {
        const compressed = await Video.compress(
            uri,
            {
                compressionMethod: 'auto',
                // Skip files that are already small enough to be worth uploading
                // as-is (2 MB), avoiding a needless re-encode.
                minimumFileSizeForCompress: 2,
                // Only report whole-percent steps to limit UI churn.
                progressDivider: 1,
            },
            (progress) => {
                if (!onProgress) return;

                const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
                onProgress(percent);
            },
        );

        onProgress?.(100);

        // `Video.compress` can resolve with a path to a stub file when the
        // transcode was interrupted (app backgrounded, no free storage, codec
        // failure). That is not reported as an error, so the result has to be
        // checked: a 28-byte "video" once reached the server and was rejected.
        // The original file is always the safer thing to upload.
        if (!compressed || !isPlausibleVideo(compressed, uri)) {
            return uri;
        }

        return compressed;
    } catch {
        // Compression is an optimisation, not a requirement: fall back to the
        // original file rather than failing the upload.
        onProgress?.(100);

        return uri;
    }
}

export default prepareVideoForUpload;
