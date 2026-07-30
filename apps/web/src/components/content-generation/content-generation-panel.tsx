'use client';

import { useState, useTransition } from 'react';

import { GeneratedContentResult } from '@/components/content-generation/generated-content-result';
import { ImageUploadForm } from '@/components/content-generation/image-upload-form';
import { generateContent } from '@/modules/content-generation/actions';
import type { GenerateContentResult } from '@/modules/content-generation/types';

/**
 * Holds the state that the form and the result view share.
 *
 * Exists so `/generate` can stay a Server Component and keep exporting
 * metadata; this is the only part of the route that has to run in the browser.
 */
export function ContentGenerationPanel() {
  const [isPending, startTransition] = useTransition();
  const [submission, setSubmission] = useState<{
    file: File;
    result: GenerateContentResult;
  } | null>(null);

  function handleGenerate(file: File) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('image', file);

      setSubmission({ file, result: await generateContent(formData) });
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <ImageUploadForm onGenerate={handleGenerate} isPending={isPending} />

      {submission?.result.status === 'rejected' && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          {submission.result.message}
        </p>
      )}

      {submission?.result.status === 'completed' && (
        <GeneratedContentResult
          originalFile={submission.file}
          caption={submission.result.caption}
          enhancement={submission.result.enhancement}
        />
      )}
    </div>
  );
}
