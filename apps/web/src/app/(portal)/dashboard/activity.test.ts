import { describe, expect, it } from 'vitest';

import { buildRecentActivity } from './activity';
import type { ActivitySources } from './activity';

function emptySources(): ActivitySources {
  return {
    generatedContent: [],
    campaigns: [],
    calendarEntries: [],
    menuAnalyses: [],
    styleAnalyses: [],
  };
}

describe('buildRecentActivity', () => {
  it('returns nothing when every source is empty', () => {
    expect(buildRecentActivity(emptySources())).toEqual([]);
  });

  it('merges items from every source into one list', () => {
    const sources: ActivitySources = {
      ...emptySources(),
      generatedContent: [
        {
          id: 'content-1',
          restaurantId: 'r1',
          recognizedDish: 'Margherita pizza',
          confidence: 0.9,
          instagram: { caption: 'c', hashtags: [] },
          facebook: { post: 'p', hashtags: [] },
          story: { text: 't', cta: 'c', stickerType: 'poll', stickerPrompt: 'p' },
          enhancedImagePath: '/img.jpg',
          createdAt: new Date('2026-08-10T10:00:00Z'),
        },
      ],
      campaigns: [
        {
          id: 'campaign-1',
          restaurantId: 'r1',
          occasion: 'Happy Hour',
          name: 'Aperitivo Hour',
          description: 'd',
          offer: 'o',
          caption: 'c',
          hashtags: [],
          story: { text: 't', cta: 'c', stickerType: 'poll', stickerPrompt: 'p' },
          cta: 'c',
          durationSuggestion: 'd',
          status: 'active',
          createdAt: new Date('2026-08-11T10:00:00Z'),
          updatedAt: new Date('2026-08-11T10:00:00Z'),
        },
      ],
      calendarEntries: [
        {
          id: 'calendar-1',
          restaurantId: 'r1',
          weekStartDate: '2026-08-10',
          dayOfWeek: 0,
          theme: 'Weekend special',
          contentAngle: 'a',
          isCompleted: false,
          createdAt: new Date('2026-08-09T10:00:00Z'),
        },
      ],
      menuAnalyses: [
        {
          id: 'menu-1',
          restaurantId: 'r1',
          overview: 'o',
          pricingNotes: 'p',
          descriptionQuality: 'd',
          upsellingIdeas: [],
          crossSellingIdeas: [],
          missingItems: [],
          improvementSuggestions: [],
          createdAt: new Date('2026-08-12T10:00:00Z'),
        },
      ],
      styleAnalyses: [
        {
          id: 'style-1',
          restaurantId: 'r1',
          profileCount: 2,
          visualStyleNotes: 'v',
          contentStyleNotes: 'c',
          contentPillars: [],
          recommendations: [],
          createdAt: new Date('2026-08-13T10:00:00Z'),
        },
      ],
    };

    const activity = buildRecentActivity(sources);

    expect(activity.map((item) => item.kind)).toEqual([
      'style-analysis',
      'menu-analysis',
      'campaign',
      'generated-content',
      'calendar-entry',
    ]);
  });

  it('sorts newest first regardless of which source an item came from', () => {
    const older = makeCampaign({ id: '1', name: 'older', createdAt: new Date('2024-01-01T00:00:00Z') });
    const newest = makeCampaign({ id: '2', name: 'newest', createdAt: new Date('2024-06-01T00:00:00Z') });
    const middle = makeCampaign({ id: '3', name: 'middle', createdAt: new Date('2024-03-01T00:00:00Z') });

    const activity = buildRecentActivity({
      ...emptySources(),
      campaigns: [older, newest, middle],
    });

    expect(activity.map((item) => item.label)).toEqual(['newest', 'middle', 'older']);
  });

  it('caps the result at 8 items even when more are available', () => {
    const campaigns = Array.from({ length: 5 }, (_, i) =>
      makeCampaign({ id: `c${i}`, name: `campaign-${i}`, createdAt: new Date(2026, 0, i + 1) }),
    );
    const menuAnalyses = Array.from({ length: 5 }, (_, i) => ({
      id: `menu-${i}`,
      restaurantId: 'r1',
      overview: 'o',
      pricingNotes: 'p',
      descriptionQuality: 'd',
      upsellingIdeas: [],
      crossSellingIdeas: [],
      missingItems: [],
      improvementSuggestions: [],
      createdAt: new Date(2026, 1, i + 1),
    }));

    const activity = buildRecentActivity({ ...emptySources(), campaigns, menuAnalyses });

    expect(activity).toHaveLength(8);
  });

  it('keeps only the most recent items when capping, not an arbitrary subset', () => {
    const campaigns = Array.from({ length: 10 }, (_, i) =>
      makeCampaign({ id: `c${i}`, name: `campaign-${i}`, createdAt: new Date(2026, 0, i + 1) }),
    );

    const activity = buildRecentActivity({ ...emptySources(), campaigns });

    expect(activity.map((item) => item.label)).toEqual([
      'campaign-9',
      'campaign-8',
      'campaign-7',
      'campaign-6',
      'campaign-5',
      'campaign-4',
      'campaign-3',
      'campaign-2',
    ]);
  });

  it('links each kind to its own detail page', () => {
    const activity = buildRecentActivity({
      ...emptySources(),
      campaigns: [makeCampaign({ id: 'abc-123', name: 'Aperitivo Hour', createdAt: new Date() })],
    });

    expect(activity[0]?.href).toBe('/campaigns#abc-123');
  });

  it('mentions the profile count for a style analysis', () => {
    const activity = buildRecentActivity({
      ...emptySources(),
      styleAnalyses: [
        {
          id: 'style-1',
          restaurantId: 'r1',
          profileCount: 1,
          visualStyleNotes: 'v',
          contentStyleNotes: 'c',
          contentPillars: [],
          recommendations: [],
          createdAt: new Date(),
        },
      ],
    });

    expect(activity[0]?.label).toBe('Style analysis (1 profile)');
  });
});

function makeCampaign({ id, name, createdAt }: { id: string; name: string; createdAt: Date }) {
  return {
    id,
    restaurantId: 'r1',
    occasion: 'Happy Hour',
    name,
    description: 'd',
    offer: 'o',
    caption: 'c',
    hashtags: [],
    story: { text: 't', cta: 'c', stickerType: 'poll' as const, stickerPrompt: 'p' },
    cta: 'c',
    durationSuggestion: 'd',
    status: 'active' as const,
    createdAt,
    updatedAt: createdAt,
  };
}
