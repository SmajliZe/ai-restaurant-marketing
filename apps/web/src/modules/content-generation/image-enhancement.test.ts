import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { enhanceImage } from './image-enhancement';

/** A gradient rather than a flat fill, so the tonal adjustments have something to act on. */
async function makePhoto(width: number, height: number): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      pixels[offset] = Math.round((x / width) * 200);
      pixels[offset + 1] = Math.round((y / height) * 160);
      pixels[offset + 2] = 90;
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 3 } })
    .jpeg()
    .toBuffer();
}

async function dimensionsOf(image: Buffer): Promise<{ width?: number; height?: number }> {
  const { width, height } = await sharp(image).metadata();
  return { width, height };
}

describe('enhanceImage', () => {
  it.each([
    ['landscape', 1600, 900],
    ['portrait', 900, 1600],
    ['square', 1200, 1200],
    ['small', 320, 240],
    ['an unusual ratio', 1000, 137],
  ])('leaves the dimensions of a %s photo untouched', async (_label, width, height) => {
    const enhanced = await enhanceImage(await makePhoto(width, height));

    expect(await dimensionsOf(enhanced)).toEqual({ width, height });
  });

  it('applies EXIF orientation, which is the one case that swaps the dimensions', async () => {
    // Orientation 6 means "rotate a quarter turn to display upright", so a
    // 900x600 file is really a 600x900 photo once the rotation is baked in.
    const sideways = await sharp(await makePhoto(900, 600))
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const enhanced = await enhanceImage(sideways);

    expect(await dimensionsOf(enhanced)).toEqual({ width: 600, height: 900 });
  });

  it('returns a JPEG', async () => {
    const enhanced = await enhanceImage(await makePhoto(1200, 1200));

    expect((await sharp(enhanced).metadata()).format).toBe('jpeg');
  });

  it('actually adjusts the pixels rather than just re-encoding', async () => {
    const photo = await makePhoto(600, 400);

    const enhanced = await enhanceImage(photo);
    const reEncodedOnly = await sharp(photo).jpeg({ quality: 90, mozjpeg: true }).toBuffer();

    expect(enhanced.equals(reEncodedOnly)).toBe(false);
  });

  it('is deterministic', async () => {
    const photo = await makePhoto(1200, 800);

    const [first, second] = await Promise.all([enhanceImage(photo), enhanceImage(photo)]);

    expect(first.equals(second)).toBe(true);
  });

  it('does not modify the input buffer', async () => {
    const photo = await makePhoto(800, 600);
    const before = Buffer.from(photo);

    await enhanceImage(photo);

    expect(photo.equals(before)).toBe(true);
  });

  it('rejects bytes that are not an image', async () => {
    await expect(enhanceImage(Buffer.from('not a photo'))).rejects.toThrow();
  });
});
