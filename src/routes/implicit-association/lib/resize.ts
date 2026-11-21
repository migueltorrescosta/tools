/** Shrink an uploaded image to a 160 px JPEG data URL, small enough to keep in localStorage. */
export async function toDataUrl(file: File, size = 160): Promise<string> {
	const bitmap = await createImageBitmap(file);
	const scale = size / Math.max(bitmap.width, bitmap.height);
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * Math.min(1, scale));
	canvas.height = Math.round(bitmap.height * Math.min(1, scale));
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas.toDataURL('image/jpeg', 0.8);
}
