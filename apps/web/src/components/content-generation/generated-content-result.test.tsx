// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { GeneratedContentResult } from '@/components/content-generation/generated-content-result';
import type {
  ContentOutcome,
  EnhancementOutcome,
  StickerType,
} from '@/modules/content-generation/types';

afterEach(() => {
  cleanup();
});

const FILE = new File(['fake-bytes'], 'dish.jpg', { type: 'image/jpeg' });

const ENHANCEMENT: EnhancementOutcome = { ok: true, enhancedImageUrl: 'blob:enhanced' };

function contentOutcome(overrides: Partial<Extract<ContentOutcome, { ok: true }>> = {}) {
  const outcome: Extract<ContentOutcome, { ok: true }> = {
    ok: true,
    recognizedDish: 'Margherita pizza',
    confidence: 0.92,
    instagram: {
      caption: 'Blistered crust and mozzarella that pulls for days.',
      hashtags: ['margherita', 'pizzanight'],
    },
    facebook: {
      post: "There's something about a pizza straight out of the oven.",
      hashtags: ['woodfiredpizza'],
    },
    story: {
      text: 'Fresh out of the oven',
      cta: 'Swipe up to book a table',
      stickerType: 'poll',
      stickerPrompt: 'Margherita or pepperoni tonight?',
    },
    ...overrides,
  };
  return outcome;
}

describe('GeneratedContentResult', () => {
  it('shows the Instagram caption by default, with its hashtags', () => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome()}
        enhancement={ENHANCEMENT}
      />,
    );

    expect(
      screen.getByText('Blistered crust and mozzarella that pulls for days.'),
    ).toBeInTheDocument();
    expect(screen.getByText('#margherita')).toBeInTheDocument();
  });

  it('switches to the Facebook post when that tab is selected', () => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome()}
        enhancement={ENHANCEMENT}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Facebook' }));

    expect(
      screen.getByText("There's something about a pizza straight out of the oven."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Blistered crust and mozzarella that pulls for days.'),
    ).not.toBeInTheDocument();
  });

  it('switches to the Story content, showing its call to action and sticker prompt', () => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome()}
        enhancement={ENHANCEMENT}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Story' }));

    expect(screen.getByText('Fresh out of the oven')).toBeInTheDocument();
    expect(screen.getByText('Swipe up to book a table')).toBeInTheDocument();
    expect(
      screen.getByText('Margherita or pepperoni tonight?', { exact: false }),
    ).toBeInTheDocument();
  });

  it.each<[StickerType, string]>([
    ['poll', 'Poll'],
    ['question', 'Question'],
    ['emoji_slider', 'Emoji slider'],
    ['countdown', 'Countdown'],
  ])('shows the sticker label for %s', (stickerType, label) => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome({ story: { ...contentOutcome().story, stickerType } })}
        enhancement={ENHANCEMENT}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Story' }));

    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('shows the confidence score next to the recognised dish, discreetly', () => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome({ confidence: 0.92 })}
        enhancement={ENHANCEMENT}
      />,
    );

    expect(screen.getByText('Margherita pizza', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('92% confident')).toBeInTheDocument();
  });

  it('rounds the confidence score to a whole percentage', () => {
    render(
      <GeneratedContentResult
        originalFile={FILE}
        content={contentOutcome({ confidence: 0.5 })}
        enhancement={ENHANCEMENT}
      />,
    );

    expect(screen.getByText('50% confident')).toBeInTheDocument();
  });

  it('shows a placeholder message instead of the tabs when generation failed', () => {
    const failed: ContentOutcome = { ok: false, message: 'Could not reach the AI service.' };

    render(
      <GeneratedContentResult originalFile={FILE} content={failed} enhancement={ENHANCEMENT} />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Could not reach the AI service.');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
