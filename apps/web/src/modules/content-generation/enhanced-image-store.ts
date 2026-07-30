import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/**
 * Somewhere to park an enhanced photo between generating it and the browser
 * fetching it.
 *
 * TODO(milestone-2): replace with real object storage (S3 or equivalent) behind
 * signed URLs. What is here now works for a single instance and nothing more:
 * the files do not survive a restart, a second replica cannot see them, and
 * nothing ever deletes them beyond whatever cleans the OS temp directory.
 *
 * Note this deliberately does not write into `public/`. Next only serves what
 * was in `public/` at build time, so a file written there at runtime is served
 * in `next dev` and 404s in a production build - the worst kind of difference
 * to discover after deploying.
 */
const STORAGE_DIRECTORY = path.join(tmpdir(), 'restaurant-ai-enhanced-images');

const URL_PREFIX = '/api/enhanced-images';

/**
 * Names are generated, so anything that does not look exactly like one is
 * rejected. A strict pattern is also what keeps `..` out of the path.
 */
const FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/;

/** Writes the image and returns the URL the browser should request. */
export async function storeEnhancedImage(image: Buffer): Promise<string> {
  const fileName = `${randomUUID()}.jpg`;

  await mkdir(STORAGE_DIRECTORY, { recursive: true });
  await writeFile(path.join(STORAGE_DIRECTORY, fileName), image);

  return `${URL_PREFIX}/${fileName}`;
}

/** Returns the stored image, or null if the name is unknown or malformed. */
export async function readEnhancedImage(fileName: string): Promise<Buffer | null> {
  if (!FILE_NAME_PATTERN.test(fileName)) {
    return null;
  }

  try {
    return await readFile(path.join(STORAGE_DIRECTORY, fileName));
  } catch {
    return null;
  }
}
