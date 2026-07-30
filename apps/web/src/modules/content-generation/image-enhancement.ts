import sharp from 'sharp';

/**
 * Instagram's tallest feed format. Anything taller gets cropped by the client,
 * so we choose the crop ourselves instead of letting it happen unsupervised.
 */
export const TARGET_WIDTH = 1080;
export const TARGET_HEIGHT = 1350;

const SATURATION_BOOST = 1.12;
const CONTRAST_GAIN = 1.06;

/**
 * Pivot the contrast stretch around mid-grey. Without the offset, `linear`
 * multiplies every channel and just brightens the photo.
 */
const CONTRAST_OFFSET = -(128 * (CONTRAST_GAIN - 1));

/**
 * Apply the house look to a photo and crop it to 4:5.
 *
 * Deterministic and free of side effects: the same bytes in always produce the
 * same bytes out, and nothing is read from or written to disk.
 */
export async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  return (
    sharp(buffer)
      // Phone cameras record orientation in EXIF rather than rotating pixels.
      // Without this, portrait shots are cropped on their side.
      .rotate()
      .resize({
        width: TARGET_WIDTH,
        height: TARGET_HEIGHT,
        fit: 'cover',
        position: 'centre',
      })
      // Stretches the tonal range to use the full histogram. Recovers flat,
      // underlit restaurant photos; despite the name it is a contrast
      // correction, not a white balance one.
      .normalise()
      .modulate({ saturation: SATURATION_BOOST })
      .linear(CONTRAST_GAIN, CONTRAST_OFFSET)
      .sharpen({ sigma: 1 })
      // Photographs, so JPEG. Transparency in the source is flattened, which is
      // what Instagram would do anyway.
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer()
  );
}
