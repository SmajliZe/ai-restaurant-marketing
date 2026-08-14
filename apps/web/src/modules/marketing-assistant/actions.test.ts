import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RestaurantProfile } from '@/modules/restaurant-profile/types';

const {
  getProfileForCurrentUser,
  repositoryMock,
  getHistoryForCurrentUser,
  getCalendarForCurrentWeek,
  getCampaignsForCurrentUser,
  getAnalysesForCurrentUser,
} = vi.hoisted(() => ({
  getProfileForCurrentUser: vi.fn(),
  repositoryMock: {
    findOrCreateConversationByRestaurantId: vi.fn(),
    findMessagesByConversationId: vi.fn(),
    addMessage: vi.fn(),
  },
  getHistoryForCurrentUser: vi.fn(),
  getCalendarForCurrentWeek: vi.fn(),
  getCampaignsForCurrentUser: vi.fn(),
  getAnalysesForCurrentUser: vi.fn(),
}));

vi.mock('@/modules/restaurant-profile/actions', () => ({ getProfileForCurrentUser }));
vi.mock('@/modules/marketing-assistant/repository', () => ({
  marketingAssistantRepository: repositoryMock,
}));
vi.mock('@/modules/content-history/actions', () => ({ getHistoryForCurrentUser }));
vi.mock('@/modules/content-calendar/actions', () => ({ getCalendarForCurrentWeek }));
vi.mock('@/modules/content-campaign/actions', () => ({ getCampaignsForCurrentUser }));
vi.mock('@/modules/menu-analysis/actions', () => ({ getAnalysesForCurrentUser }));

const { getConversationForCurrentUser, sendMessage } = await import('./actions');

const AI_SERVICE_URL = 'http://ai-service.test:8000';
const RESTAURANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_RESTAURANT_ID = '22222222-2222-4222-8222-222222222222';
const CONVERSATION_ID = 'conversation-1';

const PROFILE = {
  id: RESTAURANT_ID,
  toneOfVoice: 'friendly',
  cuisineType: 'Neapolitan pizza',
  country: 'Italy',
  language: 'English',
  targetAudience: null,
} as RestaurantProfile;

function conversation() {
  return { id: CONVERSATION_ID, restaurantId: RESTAURANT_ID, createdAt: new Date() };
}

let nextMessageId = 0;
function messageRow(role: 'user' | 'assistant', content: string) {
  nextMessageId += 1;
  return { id: `message-${nextMessageId}`, role, content, createdAt: new Date() };
}

function respondWith(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeEach(() => {
  vi.stubEnv('AI_SERVICE_URL', AI_SERVICE_URL);
  getProfileForCurrentUser.mockResolvedValue(PROFILE);
  repositoryMock.findOrCreateConversationByRestaurantId.mockResolvedValue(conversation());
  repositoryMock.findMessagesByConversationId.mockResolvedValue([]);
  repositoryMock.addMessage.mockImplementation(
    async (_conversationId: string, role: 'user' | 'assistant', content: string) =>
      messageRow(role, content),
  );
  getHistoryForCurrentUser.mockResolvedValue(null);
  getCalendarForCurrentWeek.mockResolvedValue(null);
  getCampaignsForCurrentUser.mockResolvedValue(null);
  getAnalysesForCurrentUser.mockResolvedValue(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  nextMessageId = 0;
});

describe('getConversationForCurrentUser', () => {
  it("reads only the session account's own restaurant", async () => {
    await getConversationForCurrentUser();

    expect(repositoryMock.findOrCreateConversationByRestaurantId).toHaveBeenCalledWith(
      RESTAURANT_ID,
    );
  });

  it("never queries with another account's restaurant id", async () => {
    await getConversationForCurrentUser();

    expect(repositoryMock.findOrCreateConversationByRestaurantId).not.toHaveBeenCalledWith(
      OTHER_RESTAURANT_ID,
    );
  });

  it("returns null without a profile, rather than somebody else's data", async () => {
    getProfileForCurrentUser.mockResolvedValue(null);

    expect(await getConversationForCurrentUser()).toBeNull();
    expect(repositoryMock.findOrCreateConversationByRestaurantId).not.toHaveBeenCalled();
  });
});

describe('sendMessage', () => {
  it('persists the user message, then the assistant reply, in that order', async () => {
    vi.stubGlobal('fetch', respondWith({ reply: 'Post your weekend special today!' }));

    const result = await sendMessage('What should I post today?');

    expect(result.status).toBe('sent');
    expect(repositoryMock.addMessage.mock.calls).toEqual([
      [CONVERSATION_ID, 'user', 'What should I post today?'],
      [CONVERSATION_ID, 'assistant', 'Post your weekend special today!'],
    ]);
  });

  it('sends the restaurant context and activity summary to the AI service', async () => {
    getCampaignsForCurrentUser.mockResolvedValue([
      { id: 'c1', name: 'Happy Hour Week', status: 'active', occasion: 'Happy Hour' },
    ]);
    const fetchMock = respondWith({ reply: 'Sure, happy to help!' });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('How is my campaign doing?');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${AI_SERVICE_URL}/assistant/chat`);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.context).toEqual({
      tone_of_voice: 'friendly',
      cuisine_type: 'Neapolitan pizza',
      country: 'Italy',
      language: 'English',
      target_audience: null,
      activity_summary: 'Active campaigns: Happy Hour Week.',
    });
  });

  it('sends no activity summary when there is nothing to report', async () => {
    const fetchMock = respondWith({ reply: 'Sure!' });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('Hello');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.context.activity_summary).toBeNull();
  });

  it('sends the message history as role/content pairs', async () => {
    repositoryMock.findMessagesByConversationId.mockResolvedValue([
      { id: 'm1', role: 'user', content: 'Earlier question', createdAt: new Date() },
      { id: 'm2', role: 'assistant', content: 'Earlier reply', createdAt: new Date() },
      { id: 'm3', role: 'user', content: 'What should I post today?', createdAt: new Date() },
    ]);
    const fetchMock = respondWith({ reply: 'Sure!' });
    vi.stubGlobal('fetch', fetchMock);

    await sendMessage('What should I post today?');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual([
      { role: 'user', content: 'Earlier question' },
      { role: 'assistant', content: 'Earlier reply' },
      { role: 'user', content: 'What should I post today?' },
    ]);
  });

  it('is refused outright when there is no profile, and never calls the AI service', async () => {
    const fetchMock = respondWith({ reply: 'x' });
    vi.stubGlobal('fetch', fetchMock);
    getProfileForCurrentUser.mockResolvedValue(null);

    const result = await sendMessage('Hello');

    expect(result).toEqual({
      status: 'rejected',
      message:
        'Complete your restaurant profile before chatting with the assistant, so it knows your restaurant.',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.addMessage).not.toHaveBeenCalled();
  });

  it('rejects a blank message before persisting or calling the AI service', async () => {
    const fetchMock = respondWith({ reply: 'x' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendMessage('   ');

    expect(result).toEqual({ status: 'rejected', message: 'Type a message before sending.' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.addMessage).not.toHaveBeenCalled();
  });

  it('rejects an overly long message before persisting or calling the AI service', async () => {
    const fetchMock = respondWith({ reply: 'x' });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendMessage('a'.repeat(4001));

    expect(result.status).toBe('rejected');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(repositoryMock.addMessage).not.toHaveBeenCalled();
  });

  it('accepts a message right at the length limit', async () => {
    vi.stubGlobal('fetch', respondWith({ reply: 'Got it.' }));

    const result = await sendMessage('a'.repeat(4000));

    expect(result.status).toBe('sent');
  });

  it('still keeps the persisted user message when the AI call fails', async () => {
    vi.stubGlobal(
      'fetch',
      respondWith(
        { detail: 'AI service is temporarily busy, please try again in a moment.' },
        503,
      ),
    );

    const result = await sendMessage('What should I post today?');

    expect(result).toEqual({
      status: 'rejected',
      message: 'AI service is temporarily busy, please try again in a moment.',
    });
    expect(repositoryMock.addMessage).toHaveBeenCalledWith(
      CONVERSATION_ID,
      'user',
      'What should I post today?',
    );
    // No assistant reply was appended.
    expect(repositoryMock.addMessage).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed AI response without appending an assistant message', async () => {
    vi.stubGlobal('fetch', respondWith({ notReply: 'oops' }));

    const result = await sendMessage('What should I post today?');

    expect(result).toEqual({
      status: 'rejected',
      message: 'The AI service returned an unexpected response.',
    });
    expect(repositoryMock.addMessage).toHaveBeenCalledTimes(1);
  });
});
