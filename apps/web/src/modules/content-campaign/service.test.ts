import { describe, expect, it } from 'vitest';

import { createCampaign, getCampaigns, updateCampaignStatus } from './service';
import type { Campaign, ContentCampaignRepository, NewCampaign } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

function makeCampaign(overrides: Partial<NewCampaign> = {}): NewCampaign {
  return {
    occasion: 'Happy Hour',
    name: 'Aperitivo Hour',
    description: 'A relaxed after-work window built around small plates.',
    offer: 'A complimentary small plate with any drink order',
    caption: 'The golden hour just got better.',
    hashtags: ['aperitivo', 'happyhour'],
    story: {
      text: 'Aperitivo hour is calling',
      cta: 'Swipe up to reserve a stool',
      stickerType: 'countdown',
      stickerPrompt: 'Doors open in',
    },
    cta: 'Reserve your spot for aperitivo hour',
    durationSuggestion: 'Every weekday, 5-7pm',
    ...overrides,
  };
}

function makeRow(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: crypto.randomUUID(),
    restaurantId: RESTAURANT_A,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...makeCampaign(),
    ...overrides,
  };
}

/**
 * A repository that actually filters by restaurant, the way the real one
 * does with a WHERE clause. A fake that only recorded call arguments would
 * not catch a query that quietly ignored `restaurantId` and returned, or
 * updated, everyone's rows - see the same note in content-history's
 * service.test.ts.
 */
function inMemoryRepository(): ContentCampaignRepository & { seed: (row: Campaign) => void } {
  const rows: Campaign[] = [];

  return {
    seed(row) {
      rows.push(row);
    },
    async create(restaurantId, campaign) {
      const row: Campaign = {
        id: crypto.randomUUID(),
        restaurantId,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        ...campaign,
      };
      rows.push(row);
      return row;
    },
    async findByRestaurantId(restaurantId) {
      return rows
        .filter((row) => row.restaurantId === restaurantId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async updateStatus(id, restaurantId, status) {
      const row = rows.find((candidate) => candidate.id === id);
      if (!row || row.restaurantId !== restaurantId) {
        return null;
      }
      row.status = status;
      row.updatedAt = new Date();
      return row;
    },
  };
}

describe('createCampaign', () => {
  it('stores the campaign under the given restaurant, as a draft', async () => {
    const repository = inMemoryRepository();

    const saved = await createCampaign(RESTAURANT_A, makeCampaign(), repository);

    expect(saved.restaurantId).toBe(RESTAURANT_A);
    expect(saved.status).toBe('draft');
    expect(saved.name).toBe('Aperitivo Hour');
    expect(saved.id).toBeTruthy();
  });
});

describe('getCampaigns - ownership', () => {
  it("never returns another restaurant's campaigns", async () => {
    const repository = inMemoryRepository();
    await createCampaign(RESTAURANT_A, makeCampaign({ name: 'A campaign' }), repository);
    await createCampaign(RESTAURANT_B, makeCampaign({ name: 'B campaign' }), repository);

    const campaigns = await getCampaigns(RESTAURANT_A, repository);

    expect(campaigns).toHaveLength(1);
    expect(campaigns[0]?.name).toBe('A campaign');
  });

  it('is unaffected by how many campaigns another restaurant has', async () => {
    const repository = inMemoryRepository();
    for (let i = 0; i < 20; i += 1) {
      await createCampaign(RESTAURANT_B, makeCampaign(), repository);
    }

    expect(await getCampaigns(RESTAURANT_A, repository)).toEqual([]);
  });

  it('orders newest first', async () => {
    const repository = inMemoryRepository();
    repository.seed(makeRow({ name: 'Oldest', createdAt: new Date('2024-01-01T00:00:00Z') }));
    repository.seed(makeRow({ name: 'Newest', createdAt: new Date('2024-06-01T00:00:00Z') }));
    repository.seed(makeRow({ name: 'Middle', createdAt: new Date('2024-03-01T00:00:00Z') }));

    const campaigns = await getCampaigns(RESTAURANT_A, repository);

    expect(campaigns.map((campaign) => campaign.name)).toEqual(['Newest', 'Middle', 'Oldest']);
  });
});

describe('updateCampaignStatus - ownership', () => {
  it("changes the status of the caller's own campaign", async () => {
    const repository = inMemoryRepository();
    const row = makeRow({ status: 'draft' });
    repository.seed(row);

    const updated = await updateCampaignStatus(row.id, RESTAURANT_A, 'active', repository);

    expect(updated?.status).toBe('active');
  });

  it("returns null and makes no change for another restaurant's campaign", async () => {
    const repository = inMemoryRepository();
    const row = makeRow({ restaurantId: RESTAURANT_B, status: 'draft' });
    repository.seed(row);

    const updated = await updateCampaignStatus(row.id, RESTAURANT_A, 'active', repository);

    expect(updated).toBeNull();
    const stillDraft = await getCampaigns(RESTAURANT_B, repository);
    expect(stillDraft[0]?.status).toBe('draft');
  });

  it('returns null for an id that does not exist', async () => {
    const repository = inMemoryRepository();

    const updated = await updateCampaignStatus('missing-id', RESTAURANT_A, 'completed', repository);

    expect(updated).toBeNull();
  });
});
