'use client';

import { useId, useState, useTransition } from 'react';

import { StyleAnalysisItem } from '@/components/style-analysis/style-analysis-item';
import {
  ACCEPT_ATTRIBUTE,
  describeUploadProblem,
} from '@/modules/content-generation/upload-constraints';
import { analyzeStyle } from '@/modules/style-analysis/actions';
import type { ProfileImageGroup, StyleAnalysis } from '@/modules/style-analysis/types';

const MAX_PROFILES = 3;
const MAX_POSTS_PER_PROFILE = 3;

/** A profile group mid-edit: fixed-length post slots, some possibly empty. */
type EditableGroup = { feed: File | null; posts: (File | null)[] };

function emptyGroups(): EditableGroup[] {
  return Array.from({ length: MAX_PROFILES }, () => ({
    feed: null,
    posts: Array.from({ length: MAX_POSTS_PER_PROFILE }, () => null),
  }));
}

type StyleAnalysisPanelProps = {
  /** What the page found on load. */
  initialAnalyses: StyleAnalysis[];
};

export function StyleAnalysisPanel({ initialAnalyses }: StyleAnalysisPanelProps) {
  const [groups, setGroups] = useState<EditableGroup[]>(emptyGroups);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [justAnalyzedId, setJustAnalyzedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasAnyImage = groups.some(
    (group) => group.feed !== null || group.posts.some((post) => post !== null),
  );

  function handleFeedChange(profileIndex: number, file: File | null) {
    setGroups((current) =>
      current.map((group, index) => (index === profileIndex ? { ...group, feed: file } : group)),
    );
  }

  function handlePostChange(profileIndex: number, postIndex: number, file: File | null) {
    setGroups((current) =>
      current.map((group, index) => {
        if (index !== profileIndex) {
          return group;
        }
        const posts = [...group.posts];
        posts[postIndex] = file;
        return { ...group, posts };
      }),
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasAnyImage || isPending) {
      return;
    }

    const submittableGroups: ProfileImageGroup[] = groups.map((group) => ({
      feed: group.feed,
      posts: group.posts.filter((post): post is File => post !== null),
    }));

    setMessage(null);
    startTransition(async () => {
      const result = await analyzeStyle(submittableGroups);
      if (result.status === 'rejected') {
        setMessage(result.message);
        return;
      }
      setAnalyses((current) => [result.analysis, ...current]);
      setJustAnalyzedId(result.analysis.id);
      setGroups(emptyGroups());
    });
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {groups.map((group, profileIndex) => (
          <ProfileUploadGroup
            key={profileIndex}
            profileNumber={profileIndex + 1}
            group={group}
            isPending={isPending}
            onFeedChange={(file) => handleFeedChange(profileIndex, file)}
            onPostChange={(postIndex, file) => handlePostChange(profileIndex, postIndex, file)}
          />
        ))}

        <button
          type="submit"
          disabled={!hasAnyImage || isPending}
          className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Analyzing…' : 'Analyze reference profiles'}
        </button>
      </form>

      {message !== null && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          {message}
        </p>
      )}

      {analyses.length === 0 ? (
        <p className="text-sm text-slate-400">
          No style analyses yet. Upload at least one reference profile to get started.
        </p>
      ) : (
        <ul className="flex flex-col">
          {analyses.map((analysis) => (
            <StyleAnalysisItem
              key={analysis.id}
              analysis={analysis}
              defaultExpanded={analysis.id === justAnalyzedId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type ProfileUploadGroupProps = {
  profileNumber: number;
  group: EditableGroup;
  isPending: boolean;
  onFeedChange: (file: File | null) => void;
  onPostChange: (postIndex: number, file: File | null) => void;
};

/**
 * One reference profile's upload slots: a feed overview screenshot and up
 * to three favourite posts. Every slot is optional - submitting requires
 * only that at least one image exists somewhere across all three profiles,
 * not that any one profile is complete.
 */
function ProfileUploadGroup({
  profileNumber,
  group,
  isPending,
  onFeedChange,
  onPostChange,
}: ProfileUploadGroupProps) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-slate-800 p-4">
      <legend className="px-1 text-xs font-medium tracking-widest text-slate-500 uppercase">
        Reference profile {profileNumber}
      </legend>

      <ImageSlot
        label="Feed overview"
        file={group.feed}
        onChange={onFeedChange}
        isPending={isPending}
      />

      <div className="flex flex-col gap-3">
        <span className="text-xs font-medium tracking-widest text-slate-500 uppercase">
          Favorite posts
        </span>
        <div className="grid gap-3 sm:grid-cols-3">
          {group.posts.map((post, postIndex) => (
            <ImageSlot
              key={postIndex}
              label={`Post ${postIndex + 1}`}
              file={post}
              onChange={(file) => onPostChange(postIndex, file)}
              isPending={isPending}
            />
          ))}
        </div>
      </div>
    </fieldset>
  );
}

type ImageSlotProps = {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  isPending: boolean;
};

function ImageSlot({ label, file, onChange, isPending }: ImageSlotProps) {
  const inputId = useId();
  const [problem, setProblem] = useState<string | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;

    if (selected === null) {
      setProblem(null);
      onChange(null);
      return;
    }

    // Checked here as well as on the server so an unusable file is refused
    // before it spends the user's bandwidth - the same reason
    // ImageUploadForm checks it client-side too.
    const found = describeUploadProblem(selected);
    setProblem(found);
    onChange(found === null ? selected : null);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-xs text-slate-400">
        {label}
      </label>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        onChange={handleChange}
        disabled={isPending}
        aria-describedby={problem === null ? undefined : `${inputId}-problem`}
        className="bg-surface-muted file:bg-accent w-full cursor-pointer rounded-lg border border-slate-700 text-xs text-slate-300 file:mr-3 file:cursor-pointer file:border-0 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      />
      {problem !== null && (
        <p id={`${inputId}-problem`} role="alert" className="text-xs text-rose-400">
          {problem}
        </p>
      )}
      {problem === null && file !== null && (
        <p className="truncate text-xs text-slate-500">{file.name}</p>
      )}
    </div>
  );
}
