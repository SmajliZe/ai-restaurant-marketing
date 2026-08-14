export type MessageRole = 'user' | 'assistant';

export type ConversationMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: Date;
};

export type Conversation = {
  id: string;
  restaurantId: string;
  createdAt: Date;
};

/**
 * What the service needs from storage. Declared here so the service can be
 * tested against a fake and stays free of Drizzle - the same reason
 * `ContentCampaignRepository` exists in the content-campaign module.
 */
export type MarketingAssistantRepository = {
  /**
   * Finds the restaurant's one conversation, creating it if this is its
   * first message - a single race-safe operation rather than a find then a
   * separate create, the same reasoning `upsertForOwner` uses for a
   * restaurant's profile.
   */
  findOrCreateConversationByRestaurantId: (restaurantId: string) => Promise<Conversation>;
  findMessagesByConversationId: (conversationId: string) => Promise<ConversationMessage[]>;
  addMessage: (
    conversationId: string,
    role: MessageRole,
    content: string,
  ) => Promise<ConversationMessage>;
};

export type SendMessageResult =
  | { status: 'sent'; messages: ConversationMessage[] }
  | { status: 'rejected'; message: string };
