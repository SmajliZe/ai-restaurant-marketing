import { readEnhancedImage } from '@/modules/content-generation/enhanced-image-store';

/**
 * Serves an enhanced photo produced by the content-generation Server Action.
 *
 * A route handler rather than a file in `public/`, because Next only serves
 * what `public/` held at build time.
 */
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  const image = await readEnhancedImage(name);

  if (image === null) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(new Uint8Array(image), {
    headers: {
      'Content-Type': 'image/jpeg',
      // The name is a UUID, so the bytes behind it never change. Private
      // because the photo belongs to whoever uploaded it.
      'Cache-Control': 'private, max-age=3600, immutable',
    },
  });
}
