import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateContent } from './actions';

const AI_SERVICE_URL = 'http://ai-service.test:8000';

async function jpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 200, g: 120, b: 60 } },
  })
    .jpeg()
    .toBuffer();
}

async function formDataWith(
  content: Buffer | string,
  { name = 'dish.jpg', type = 'image/jpeg' } = {},
): Promise<FormData> {
  const formData = new FormData();
  formData.append('image', new File([new Uint8Array(Buffer.from(content))], name, { type }));
  return formData;
}

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const CAPTION_BODY = {
  recognized_dish: 'Margherita pizza',
  caption: 'Blistered crust and mozzarella that pulls for days.',
  hashtags: ['margherita', 'pizzanight'],
};

beforeEach(() => {
  vi.stubEnv('AI_SERVICE_URL', AI_SERVICE_URL);
  // The action logs unexpected failures; tests deliberately cause some.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generateContent', () => {
  it('returns both halves when everything works', async () => {
    vi.stubGlobal('fetch', respondWith(CAPTION_BODY));

    const result = await generateContent(await formDataWith(await jpeg()));

    expect(result).toMatchObject({
      status: 'completed',
      caption: { ok: true, recognizedDish: 'Margherita pizza' },
      enhancement: { ok: true },
    });
  });

  it('posts the photo to the AI service', async () => {
    const fetchMock = respondWith(CAPTION_BODY);
    vi.stubGlobal('fetch', fetchMock);

    await generateContent(await formDataWith(await jpeg()));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/content/generate-caption`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
  });

  it('still enhances the photo when the AI call fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const result = await generateContent(await formDataWith(await jpeg()));

    expect(result).toMatchObject({
      status: 'completed',
      caption: { ok: false },
      enhancement: { ok: true },
    });
  });

  it('still returns the caption when the enhancement fails', async () => {
    vi.stubGlobal('fetch', respondWith(CAPTION_BODY));

    const result = await generateContent(await formDataWith('not really a jpeg'));

    expect(result).toMatchObject({
      status: 'completed',
      caption: { ok: true, recognizedDish: 'Margherita pizza' },
      enhancement: { ok: false },
    });
  });

  it('does not leak library internals when the enhancement fails', async () => {
    vi.stubGlobal('fetch', respondWith(CAPTION_BODY));

    const result = await generateContent(await formDataWith('not really a jpeg'));

    expect(result.status).toBe('completed');
    if (result.status !== 'completed' || result.enhancement.ok) {
      throw new Error('expected the enhancement to have failed');
    }
    expect(result.enhancement.message).toBe(
      'Could not process that photo. It may be corrupted or in an unusual format.',
    );
    // sharp's own wording must not reach the page.
    expect(result.enhancement.message).not.toMatch(/buffer|sharp|vips/i);
  });

  it('passes through the message the AI service wrote for the user', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith({ detail: 'AI service is temporarily busy, please try again in a moment.' }, 503),
    );

    const result = await generateContent(await formDataWith(await jpeg()));

    expect(result).toMatchObject({
      caption: {
        ok: false,
        message: 'AI service is temporarily busy, please try again in a moment.',
      },
    });
  });

  it('replaces an unexpected AI failure with a generic message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('getaddrinfo EAI_AGAIN')));

    const result = await generateContent(await formDataWith(await jpeg()));

    expect(result).toMatchObject({
      caption: { ok: false, message: 'Could not reach the AI service.' },
    });
  });

  it.each([
    ['an unsupported type', { name: 'notes.txt', type: 'text/plain' }],
    ['an empty file', { name: 'empty.jpg', type: 'image/jpeg' }],
  ])('refuses %s without calling the AI service', async (_label, options) => {
    const fetchMock = respondWith(CAPTION_BODY);
    vi.stubGlobal('fetch', fetchMock);
    const content = options.name === 'empty.jpg' ? '' : 'hello';

    const result = await generateContent(await formDataWith(content, options));

    expect(result.status).toBe('rejected');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a request with no file at all', async () => {
    const result = await generateContent(new FormData());

    expect(result).toEqual({ status: 'rejected', message: 'Choose a photo to upload.' });
  });
});
