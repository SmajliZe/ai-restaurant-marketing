import type {
  Conversation,
  ConversationMessage,
  MarketingAssistantRepository,
  MessageRole,
} from '@/modules/marketing-assistant/types';

/** `restaurantId`'s one conversation, creating it if this is its first message. */
export async function getOrCreateConversation(
  restaurantId: string,
  repository: MarketingAssistantRepository,
): Promise<Conversation> {
  return repository.findOrCreateConversationByRestaurantId(restaurantId);
}

/** `conversationId`'s messages, oldest first. */
export async function getMessages(
  conversationId: string,
  repository: MarketingAssistantRepository,
): Promise<ConversationMessage[]> {
  return repository.findMessagesByConversationId(conversationId);
}

/** Appends one turn to `conversationId`. */
export async function appendMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  repository: MarketingAssistantRepository,
): Promise<ConversationMessage> {
  return repository.addMessage(conversationId, role, content);
}
