'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { sendMessage } from '@/modules/marketing-assistant/actions';
import type { ConversationMessage } from '@/modules/marketing-assistant/types';

type AssistantChatPanelProps = {
  /** What the page found on load. */
  initialMessages: ConversationMessage[];
};

/**
 * A client component holding local message state and calling `sendMessage`
 * directly - the same Server-Action-then-setState pattern every other panel
 * in this app uses (CampaignsPanel, CalendarPanel, MenuAnalysisPanel), not a
 * new one. The one addition a chat interface reasonably calls for is a local
 * optimistic echo of the owner's own message: it is appended to the list
 * immediately on send, then replaced by the server's authoritative list
 * (which includes that same message, persisted, alongside the reply) once
 * `sendMessage` resolves - there is no merge logic to get wrong, since the
 * whole list is always replaced wholesale, the same way every other panel's
 * `setX(result.x)` already works.
 *
 * No streaming: nothing in this app streams a reply token by token, and
 * adding that here would be a bigger architectural change than this feature
 * calls for - the "Thinking…" state below is what every other panel's
 * `isPending` already provides.
 */
export function AssistantChatPanel({ initialMessages }: AssistantChatPanelProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isPending]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (content === '' || isPending) {
      return;
    }

    setError(null);
    setDraft('');
    setMessages((current) => [
      ...current,
      { id: `pending-${Date.now()}`, role: 'user', content, createdAt: new Date() },
    ]);

    startTransition(async () => {
      const result = await sendMessage(content);
      if (result.status === 'rejected') {
        setError(result.message);
        return;
      }
      setMessages(result.messages);
    });
  }

  return (
    <div className="flex h-[65vh] flex-col gap-4">
      <div className="flex-1 overflow-y-auto rounded-lg border border-slate-800 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-400">
            Ask anything about your restaurant&apos;s marketing - what to post today, how to run
            a promotion, how to increase engagement.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    message.role === 'user'
                      ? 'bg-accent text-slate-950'
                      : 'bg-surface-muted text-slate-100'
                  }`}
                >
                  {message.content}
                </p>
              </li>
            ))}
          </ul>
        )}
        {isPending && <p className="mt-3 text-xs text-slate-500">Thinking…</p>}
        <div ref={listEndRef} />
      </div>

      {error !== null && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="assistant-message" className="sr-only">
          Message the assistant
        </label>
        <input
          id="assistant-message"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={isPending}
          placeholder="Ask what to post, how to run a promotion..."
          className="bg-surface-muted flex-1 rounded-lg px-4 py-2.5 text-sm text-slate-100 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={draft.trim() === '' || isPending}
          className="bg-accent rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
