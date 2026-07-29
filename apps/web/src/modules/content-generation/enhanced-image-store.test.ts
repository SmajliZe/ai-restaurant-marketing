import { describe, expect, it } from 'vitest';

import { readEnhancedImage, storeEnhancedImage } from './enhanced-image-store';

function fileNameFrom(url: string): string {
  return url.slice(url.lastIndexOf('/') + 1);
}

describe('enhanced image store', () => {
  it('hands back a URL the route handler can serve', async () => {
    const url = await storeEnhancedImage(Buffer.from('pretend jpeg'));

    expect(url).toMatch(
      /^\/api\/enhanced-images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/,
    );
  });

  it('reads back exactly what was written', async () => {
    const image = Buffer.from('pretend jpeg');

    const stored = await readEnhancedImage(fileNameFrom(await storeEnhancedImage(image)));

    expect(stored).toEqual(image);
  });

  it('gives each image its own name', async () => {
    const [first, second] = await Promise.all([
      storeEnhancedImage(Buffer.from('one')),
      storeEnhancedImage(Buffer.from('two')),
    ]);

    expect(first).not.toBe(second);
  });

  it.each([
    ['a name that is not a UUID', 'dish.jpg'],
    ['the wrong extension', '3f2504e0-4f89-41d3-9a0c-0305e82c3301.png'],
    ['a relative path', '../package.json'],
    ['an absolute path', '/etc/passwd'],
    ['a traversal dressed up as a UUID', '../3f2504e0-4f89-41d3-9a0c-0305e82c3301.jpg'],
    ['an empty name', ''],
  ])('refuses %s', async (_label, fileName) => {
    expect(await readEnhancedImage(fileName)).toBeNull();
  });

  it('returns null for a name that was never stored', async () => {
    expect(await readEnhancedImage('3f2504e0-4f89-41d3-9a0c-0305e82c3301.jpg')).toBeNull();
  });
});
