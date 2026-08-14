import { describe, expect, it } from 'vitest';

import { appendMessage, getMessages, getOrCreateConversation } from './service';
import type { Conversation, ConversationMessage, MarketingAssistantRepository } from './types';

const RESTAURANT_A = '11111111-1111-4111-8111-111111111111';
const RESTAURANT_B = '22222222-2222-4222-8222-222222222222';

/**
 * A repository that actually filters and isolates by restaurant, the way
 * the real one does with a unique restaurant_id and a foreign key. A fake
 * that only recorded call arguments would not catch a query that quietly
 * ignored restaurantId and returned, or appended to, another restaurant's
 * conversation - see the same note in content-history's service.test.ts.
 */
function inMemoryRepository(): MarketingAssistantRepository {
  const conversationsByRestaurantId = new Map<string, Conversation>();
  const messagesByConversationId = new Map<string, ConversationMessage[]>();

  return {
    async findOrCreateConversationByRestaurantId(restaurantId) {
      const existing = conversationsByRestaurantId.get(restaurantId);
      if (existing) {
        return existing;
      }
      const created: Conversation = {
        id: crypto.randomUUID(),
        restaurantId,
        createdAt: new Date(),
      };
      conversationsByRestaurantId.set(restaurantId, created);
      messagesByConversationId.set(created.id, []);
      return created;
    },
    async findMessagesByConversationId(conversationId) {
      return messagesByConversationId.get(conversationId) ?? [];
    },
    async addMessage(conversationId, role, content) {
      const message: ConversationMessage = {
        id: crypto.randomUUID(),
        role,
        content,
        createdAt: new Date(),
      };
      const list = messagesByConversationId.get(conversationId) ?? [];
      list.push(message);
      messagesByConversationId.set(conversationId, list);
      return message;
    },
  };
}

describe('getOrCreateConversation', () => {
  it('creates a new conversation on the first call', async () => {
    const repository = inMemoryRepository();

    const conversation = await getOrCreateConversation(RESTAURANT_A, repository);

    expect(conversation.restaurantId).toBe(RESTAURANT_A);
    expect(conversation.id).toBeTruthy();
  });

  it('returns the same conversation on a later call, rather than a new one', async () => {
    const repository = inMemoryRepository();

    const first = await getOrCreateConversation(RESTAURANT_A, repository);
    const second = await getOrCreateConversation(RESTAURANT_A, repository);

    expect(second.id).toBe(first.id);
  });

  it("never returns another restaurant's conversation", async () => {
    const repository = inMemoryRepository();

    const conversationA = await getOrCreateConversation(RESTAURANT_A, repository);
    const conversationB = await getOrCreateConversation(RESTAURANT_B, repository);

    expect(conversationA.id).not.toBe(conversationB.id);
    expect(conversationA.restaurantId).toBe(RESTAURANT_A);
    expect(conversationB.restaurantId).toBe(RESTAURANT_B);
  });
});

describe('getMessages - ownership', () => {
  it("never returns another conversation's messages", async () => {
    const repository = inMemoryRepository();
    const conversationA = await getOrCreateConversation(RESTAURANT_A, repository);
    const conversationB = await getOrCreateConversation(RESTAURANT_B, repository);
    await appendMessage(conversationA.id, 'user', 'A message', repository);
    await appendMessage(conversationB.id, 'user', 'B message', repository);

    const messages = await getMessages(conversationA.id, repository);

    expect(messages).toHaveLength(1);
    expect(messages[0]?.content).toBe('A message');
  });

  it('is unaffected by how many messages another conversation has', async () => {
    const repository = inMemoryRepository();
    const conversationA = await getOrCreateConversation(RESTAURANT_A, repository);
    const conversationB = await getOrCreateConversation(RESTAURANT_B, repository);
    for (let i = 0; i < 20; i += 1) {
      await appendMessage(conversationB.id, 'user', `Message ${i}`, repository);
    }

    expect(await getMessages(conversationA.id, repository)).toEqual([]);
  });

  it('returns an empty list for a conversation with no messages yet', async () => {
    const repository = inMemoryRepository();
    const conversation = await getOrCreateConversation(RESTAURANT_A, repository);

    expect(await getMessages(conversation.id, repository)).toEqual([]);
  });
});

describe('appendMessage', () => {
  it('appends the message to the given conversation', async () => {
    const repository = inMemoryRepository();
    const conversation = await getOrCreateConversation(RESTAURANT_A, repository);

    const message = await appendMessage(conversation.id, 'assistant', 'Try a weekend special.', repository);

    expect(message.role).toBe('assistant');
    expect(message.content).toBe('Try a weekend special.');
    const messages = await getMessages(conversation.id, repository);
    expect(messages).toEqual([message]);
  });
});
