/** Vite clientの応答から開発配信を判定し、サーバー障害は失敗として扱う。 */
export function isViteDevelopmentResponse(status: number, contentType: string): boolean {
    if (status === 404) return false;
    if (status !== 200) throw new Error(`Vite client確認で予期しないHTTP状態: ${status}`);
    const mediaType = contentType.split(';')[0].trim().toLowerCase();
    if (mediaType === 'text/html') return false; // ビルド済みSPAのindex.htmlへのフォールバック。
    if (mediaType === 'text/javascript' || mediaType === 'application/javascript') return true;
    throw new Error(`Vite client確認で予期しないContent-Type: ${contentType}`);
}
