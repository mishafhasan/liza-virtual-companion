import { env } from '@/config/env';

/**
 * Avatar image generation via Pollinations.ai (FLUX model).
 *
 * Isolated from the UI so the component only deals with state, not HTTP/JSON
 * plumbing. Returns a data URL (base64 PNG) ready to store on the character
 * profile. Throws a descriptive error the caller can show to the user.
 *
 * Pollinations offers a free public endpoint with no API key required.
 * When a POLLINATIONS_API_KEY is set we use the authenticated v1 API
 * (higher rate limits, private). Otherwise we fall back to the public
 * no-auth endpoint.
 */

/** True when avatar generation is available (Pollinations is always free). */
export const canGenerateAvatar = (): boolean => true;

/**
 * Generates a portrait from a free-text appearance description.
 * @returns a data URL string (image/png).
 */
export async function generateAvatar(appearancePrompt: string): Promise<string> {
  const prompt = `professional portrait photo of a beautiful young woman, ${appearancePrompt}, centered face, high quality, detailed facial features, soft lighting, 8k resolution, photorealistic`;
  const apiKey = env.pollinationsApiKey;

  if (apiKey) {
    return generateViaApi(prompt, apiKey);
  }
  return generateViaPublic(prompt);
}

/** Authenticated v1/images/generations — returns b64_json directly. */
async function generateViaApi(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://gen.pollinations.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model: 'flux',
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pollinations API error ${response.status}: ${errorText}`);
  }

  const json: { data?: Array<{ b64_json?: string }> } = await response.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('Pollinations returned no image data.');

  return `data:image/png;base64,${b64}`;
}

/** Free public endpoint — fetches the image blob and converts to data URL. */
async function generateViaPublic(prompt: string): Promise<string> {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Pollinations public API error ${response.status}: ${errorText}`);
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
