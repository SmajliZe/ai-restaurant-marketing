'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  ContentOutcome,
  EnhancementOutcome,
  FacebookContent,
  InstagramContent,
  StickerType,
  StoryContent,
} from '@/modules/content-generation/types';

type GeneratedContentResultProps = {
  /** The file the user picked. Previewed locally, never uploaded twice. */
  originalFile: File;
  content: ContentOutcome;
  enhancement: EnhancementOutcome;
};

export function GeneratedContentResult({
  originalFile,
  content,
  enhancement,
}: GeneratedContentResultProps) {
  const originalUrl = useObjectUrl(originalFile);

  return (
    <section className="flex flex-col gap-8" aria-label="Generated content">
      {/* Both images have the same dimensions, so they line up side by side
          without either being scaled or cropped to match the other. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ImagePanel title="Original" src={originalUrl} note="As uploaded" />
        {enhancement.ok ? (
          <ImagePanel
            title="Enhanced"
            src={enhancement.enhancedImageUrl}
            note="Same framing, colour and sharpness corrected"
          />
        ) : (
          <Placeholder title="Enhanced" message={enhancement.message} />
        )}
      </div>

      {content.ok ? (
        <ContentPanel
          recognizedDish={content.recognizedDish}
          confidence={content.confidence}
          instagram={content.instagram}
          facebook={content.facebook}
          story={content.story}
        />
      ) : (
        <Placeholder title="Content" message={content.message} />
      )}
    </section>
  );
}

type ContentTab = 'instagram' | 'facebook' | 'story';

const TABS: { id: ContentTab; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'story', label: 'Story' },
];

function ContentPanel({
  recognizedDish,
  confidence,
  instagram,
  facebook,
  story,
}: {
  recognizedDish: string;
  confidence: number;
  instagram: InstagramContent;
  facebook: FacebookContent;
  story: StoryContent;
}) {
  const [activeTab, setActiveTab] = useState<ContentTab>('instagram');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <PanelHeading>Recognised dish</PanelHeading>
        <p className="text-lg font-medium text-slate-100">
          {recognizedDish}{' '}
          <span className="text-xs font-normal text-slate-500">
            {Math.round(confidence * 100)}% confident
          </span>
        </p>
      </div>

      <div role="tablist" aria-label="Generated content by platform" className="flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              activeTab === tab.id
                ? 'bg-surface-muted text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {activeTab === 'instagram' && (
          <TextWithHashtagsPanel text={instagram.caption} hashtags={instagram.hashtags} />
        )}
        {activeTab === 'facebook' && (
          <TextWithHashtagsPanel text={facebook.post} hashtags={facebook.hashtags} />
        )}
        {activeTab === 'story' && <StoryPanel story={story} />}
      </div>
    </div>
  );
}

function TextWithHashtagsPanel({ text, hashtags }: { text: string; hashtags: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-4">
          <CopyButton value={text} />
        </div>
        <p className="bg-surface-muted rounded-lg p-4 text-slate-200">{text}</p>
      </div>

      {hashtags.length > 0 && (
        <div className="flex flex-col gap-2">
          <PanelHeading>Hashtags</PanelHeading>
          <ul className="flex flex-wrap gap-2">
            {hashtags.map((hashtag) => (
              <li
                key={hashtag}
                className="bg-surface-muted rounded-full px-3 py-1 text-sm text-slate-300"
              >
                #{hashtag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const STICKER_LABELS: Record<StickerType, string> = {
  poll: 'Poll',
  question: 'Question',
  emoji_slider: 'Emoji slider',
  countdown: 'Countdown',
};

function StoryPanel({ story }: { story: StoryContent }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-end gap-4">
          <CopyButton value={story.text} />
        </div>
        <p className="bg-surface-muted rounded-lg p-4 text-slate-200">{story.text}</p>
      </div>

      <div className="flex flex-col gap-1">
        <PanelHeading>Call to action</PanelHeading>
        <p className="text-slate-300">{story.cta}</p>
      </div>

      <div className="flex flex-col gap-1">
        <PanelHeading>Sticker</PanelHeading>
        <p className="text-slate-300">
          <span className="bg-surface-muted rounded-full px-3 py-1 text-sm text-slate-300">
            {STICKER_LABELS[story.stickerType]}
          </span>{' '}
          {story.stickerPrompt}
        </p>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      // Clipboard access is denied outside a secure context, which is easy to
      // hit on a LAN address during development.
      setState('failed');
    }
  }

  useEffect(() => {
    if (state === 'idle') {
      return;
    }
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-slate-700 px-3 py-1 text-xs font-medium text-slate-300 hover:border-slate-500"
    >
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
      </span>
    </button>
  );
}

function ImagePanel({ title, src, note }: { title: string; src: string; note: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <PanelHeading>{title}</PanelHeading>
      <div className="bg-surface-muted overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element --
            next/image rejects blob: URLs, and the enhanced file is a one-off
            that the optimiser would only copy. */}
        <img src={src} alt={`${title} photo of the dish`} className="w-full" />
      </div>
      <figcaption className="text-xs text-slate-500">{note}</figcaption>
    </figure>
  );
}

function Placeholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-2">
      <PanelHeading>{title}</PanelHeading>
      <p
        role="alert"
        className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-sm text-amber-200"
      >
        {message}
      </p>
    </div>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-medium tracking-widest text-slate-500 uppercase">{children}</h2>
  );
}

/**
 * Preview URL for a local file, revoked once the component stops using it.
 *
 * Derived during render rather than in an effect so the image is present on the
 * first paint instead of after a second one.
 */
function useObjectUrl(file: File): string {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return url;
}
