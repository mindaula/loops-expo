import { Video } from 'react-native-compressor';

/**
 * Compresses a recorded or picked video before it is uploaded.
 *
 * `onProgress` receives whole percentages (0-100) so callers can render a
 * "Preparing… 42%" style label directly. The returned value is the path of the
 * file to upload; if compression is skipped or fails, the original path is
 * returned so the upload can still go ahead.
 */
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

        return compressed || uri;
    } catch {
        // Compression is an optimisation, not a requirement: fall back to the
        // original file rather than failing the upload.
        onProgress?.(100);

        return uri;
    }
}

export default prepareVideoForUpload;
