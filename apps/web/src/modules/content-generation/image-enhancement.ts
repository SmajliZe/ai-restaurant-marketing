import sharp from 'sharp';

const SATURATION_BOOST = 1.12;
const CONTRAST_GAIN = 1.06;

/**
 * Pivot the contrast stretch around mid-grey. Without the offset, `linear`
 * multiplies every channel and just brightens the photo.
 */
const CONTRAST_OFFSET = -(128 * (CONTRAST_GAIN - 1));

/**
 * Apply the house look to a photo, leaving its framing alone.
 *
 * Nothing here resizes or crops: the output keeps the pixel dimensions of the
 * input. The one exception is a photo whose EXIF orientation calls for a
 * quarter turn, where width and height swap because `rotate` bakes that
 * rotation into the pixels.
 *
 * Deterministic and free of side effects: the same bytes in always produce the
 * same bytes out, and nothing is read from or written to disk.
 */
export async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  return (
    sharp(buffer)
      // Phone cameras record orientation in EXIF rather than rotating pixels.
      // Without this, portrait shots come out on their side.
      .rotate()
      // Stretches the tonal range to use the full histogram. Recovers flat,
      // underlit restaurant photos; despite the name it is a contrast
      // correction, not a white balance one.
      .normalise()
      .modulate({ saturation: SATURATION_BOOST })
      .linear(CONTRAST_GAIN, CONTRAST_OFFSET)
      .sharpen({ sigma: 1 })
      // Photographs, so JPEG. Transparency in the source is flattened, which is
      // what a social feed would do anyway.
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer()
  );
}
