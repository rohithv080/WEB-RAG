import { getGroqClient } from "../groq";

/**
 * Downloads an image from a URL, converts it to base64, and asks Groq Vision to describe it.
 * @param imageUrl The URL of the image to describe
 * @returns The text description of the image, or null if it failed
 */
export async function describeImage(imageUrl: string): Promise<string | null> {
  try {
    // 1. Fetch the image
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");
    
    // We assume it's jpeg or png. Groq is usually fine if we just pass a valid data URI.
    const mimeType = res.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    // 2. Call Groq Vision
    const completion = await getGroqClient().chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image in detail. If there is any text in the image, transcribe it accurately. Be concise.",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.warn(`[vision] Failed to describe image ${imageUrl}:`, error);
    return null;
  }
}
