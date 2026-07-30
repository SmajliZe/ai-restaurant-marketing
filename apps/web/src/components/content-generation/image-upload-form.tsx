'use client';

import { useId, useRef, useState } from 'react';

import {
  ACCEPT_ATTRIBUTE,
  describeUploadProblem,
} from '@/modules/content-generation/upload-constraints';

type ImageUploadFormProps = {
  onGenerate: (file: File) => void;
  isPending: boolean;
};

export function ImageUploadForm({ onGenerate, isPending }: ImageUploadFormProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (selected === null) {
      setFile(null);
      setProblem(null);
      return;
    }

    // Checked here as well as on the server so an unusable file is refused
    // before it spends the user's bandwidth.
    const found = describeUploadProblem(selected);
    setProblem(found);
    setFile(found === null ? selected : null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file !== null) {
      onGenerate(file);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium text-slate-200">
          Photo of the dish
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name="image"
          accept={ACCEPT_ATTRIBUTE}
          onChange={handleChange}
          disabled={isPending}
          aria-describedby={problem === null ? undefined : `${inputId}-problem`}
          className="bg-surface-muted file:bg-accent w-full cursor-pointer rounded-lg border border-slate-700 text-sm text-slate-300 file:mr-4 file:cursor-pointer file:border-0 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="text-xs text-slate-500">JPEG, PNG or WebP, up to 10 MB.</p>
      </div>

      {problem !== null && (
        <p id={`${inputId}-problem`} role="alert" className="text-sm text-rose-400">
          {problem}
        </p>
      )}

      <button
        type="submit"
        disabled={file === null || isPending}
        className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? 'Generating…' : 'Generate caption'}
      </button>
    </form>
  );
}
