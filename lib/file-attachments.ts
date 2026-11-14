export interface AttachedImage {
	id: string;
	name: string;
	data: string; // Base64 without data: URL prefix
	mimeType: string;
}

export const INSERT_TEXT_EVENT = "lh:insert-text";
export const ATTACH_IMAGE_EVENT = "lh:attach-image";

export function isImageFile(file: File): boolean {
	if (file.type.startsWith("image/")) return true;
	return /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(file.name);
}

export function isTextFile(file: File): boolean {
	if (file.type.startsWith("text/")) return true;
	return /\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|py|html|css|scss|xml|yaml|yml|sql|rs|go|c|cpp|h|hpp|sh|bash|zsh)$/i.test(file.name);
}

export async function processAttachmentFiles(
	files: FileList | File[],
	targetElement: HTMLElement | null,
	onImagesAttached?: (images: AttachedImage[]) => void,
): Promise<{ imageCount: number; textCount: number }> {
	const fileList = Array.from(files);
	const newImages: AttachedImage[] = [];
	let textCount = 0;

	for (const file of fileList) {
		if (isImageFile(file)) {
			try {
				const base64Data = await readImageAsBase64(file);
				const mimeType = file.type || "image/png";
				newImages.push({
					id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
					name: file.name,
					data: base64Data,
					mimeType,
				});
			} catch (err) {
				console.error("Failed to read image file", file.name, err);
			}
		} else if (isTextFile(file)) {
			try {
				const text = await file.text();
				const ext = file.name.split(".").pop() ?? "";
				const formattedText = `\n\n[File: ${file.name}]\n\`\`\`${ext}\n${text.trim()}\n\`\`\`\n`;
				textCount++;
				if (targetElement) {
					targetElement.dispatchEvent(
						new CustomEvent(INSERT_TEXT_EVENT, { detail: formattedText, bubbles: true })
					);
				}
			} catch (err) {
				console.error("Failed to read text file", file.name, err);
			}
		}
	}

	if (newImages.length > 0) {
		if (onImagesAttached) {
			onImagesAttached(newImages);
		}
		if (targetElement) {
			targetElement.dispatchEvent(
				new CustomEvent(ATTACH_IMAGE_EVENT, { detail: newImages, bubbles: true })
			);
		}
	}

	return { imageCount: newImages.length, textCount };
}

function readImageAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result as string;
			const commaIndex = result.indexOf(",");
			resolve(commaIndex !== -1 ? result.slice(commaIndex + 1) : result);
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}
