/**
 * Reusable clipboard utility
 */

/**
 * Copy text to the system clipboard
 * @param text - The text to copy to clipboard
 * @returns Promise that resolves when the text is copied
 */
export async function copyToClipboard(text: string): Promise<void> {
	await navigator.clipboard.writeText(text);
}