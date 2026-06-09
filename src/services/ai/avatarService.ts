import { env } from '@/config/env';

/**
 * Avatar image generation via Stability AI.
 *
 * Isolated from the UI so the component only deals with state, not HTTP/FormData
 * plumbing. Returns a data URL (base64 PNG) ready to store on the character
 * profile. Throws a descriptive error the caller can show to the user.
 */

/** True when a Stability key is configured. */
export const canGenerateAvatar = (): boolean => env.stabilityApiKey.length > 0;

/**
 * Generates a portrait from a free-text appearance description.
 * @returns a data URL string (image/png).
 */
export async function generateAvatar(appearancePrompt: string): Promise<string> {
  const apiKey = env.stabilityApiKey;
  if (!apiKey) {
    throw new Error(
      'Add STABILITY_API_KEY to your .env.local. Get a free key at platform.stability.ai',
    );
  }

  const formData = new FormData();
  formData.append(
    'prompt',
    `professional portrait photo of a beautiful young woman, ${appearancePrompt}, centered face, high quality, detailed facial features, soft lighting, 8k resolution, photorealistic`,
  );
  formData.append('output_format', 'png');
  formData.append('aspect_ratio', '1:1');

  const response = await fetch('https://api.stability.ai/v2beta/stable-image/generate/core', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'image/*' },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stability API error ${response.status}: ${errorText}`);
  }

  const blob = await response.blob();
  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read generated image.'));
    reader.readAsDataURL(blob);
  });
}
