import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { enhanceImage, TARGET_HEIGHT, TARGET_WIDTH } from './image-enhancement';

async function makePhoto(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe('enhanceImage', () => {
  it.each([
    ['landscape', 1600, 900],
    ['portrait', 900, 1600],
    ['square', 1200, 1200],
    ['smaller than the target', 400, 300],
  ])('crops a %s photo to 4:5', async (_label, width, height) => {
    const enhanced = await enhanceImage(await makePhoto(width, height));

    const { width: outputWidth, height: outputHeight } = await sharp(enhanced).metadata();

    expect(outputWidth).toBe(TARGET_WIDTH);
    expect(outputHeight).toBe(TARGET_HEIGHT);
    expect(outputWidth! / outputHeight!).toBeCloseTo(4 / 5);
  });

  it('returns a JPEG', async () => {
    const enhanced = await enhanceImage(await makePhoto(1200, 1200));

    expect((await sharp(enhanced).metadata()).format).toBe('jpeg');
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
