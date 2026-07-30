import type { Metadata } from 'next';

import { ContentGenerationPanel } from '@/components/content-generation/content-generation-panel';

export const metadata: Metadata = {
  title: 'Generate a caption',
  description:
    'Turn a photo of a dish into an Instagram caption and a polished version of the photo.',
};

export default function GeneratePage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">
          Content generation
        </p>
        <h1 className="text-3xl font-semibold text-balance">Turn a dish photo into a post</h1>
        <p className="max-w-2xl text-slate-400">
          Upload a photo and we will identify the dish, draft a caption with hashtags, and return a
          colour-corrected version of the photo at its original size. The two run independently, so
          a failure in one still leaves you the other.
        </p>
      </header>

      <ContentGenerationPanel />
    </main>
  );
}
