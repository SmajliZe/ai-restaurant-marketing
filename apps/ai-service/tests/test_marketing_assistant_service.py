"""Domain-level rules: what the assistant service sends and what it refuses."""

from __future__ import annotations

import pytest

from app.domain.content_generation.errors import AIResponseMalformedError, AIServiceBusyError
from app.domain.marketing_assistant.service import MAX_HISTORY_MESSAGES, chat
from app.schemas.marketing_assistant import (
    AssistantChatRequest,
    AssistantRequestContext,
    ChatMessage,
)
from tests.conftest import RecordingMarketingAssistant

EMPTY_CONTEXT = AssistantRequestContext()


def request_with(
    messages: list[ChatMessage], context: AssistantRequestContext = EMPTY_CONTEXT
) -> AssistantChatRequest:
    return AssistantChatRequest(messages=messages, context=context)


def user_message(content: str = "What should I post today?") -> ChatMessage:
    return ChatMessage(role="user", content=content)


async def test_returns_the_reply_for_a_simple_message(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    result = await chat(request_with([user_message()]), marketing_assistant=marketing_assistant)

    assert result.reply == marketing_assistant.result
    assert marketing_assistant.calls == [[user_message()]]


async def test_sends_the_restaurant_context_to_the_assistant(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    context = AssistantRequestContext(
        tone_of_voice="luxury",
        cuisine_type="Neapolitan pizza",
        country="Italy",
        language="German",
        target_audience="young professionals",
    )

    await chat(request_with([user_message()], context), marketing_assistant=marketing_assistant)

    assert marketing_assistant.contexts == [
        ("luxury", "Neapolitan pizza", "Italy", "German", "young professionals", None)
    ]


async def test_sends_the_activity_summary_when_present(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    context = AssistantRequestContext(activity_summary="Posted about the Margherita pizza.")

    await chat(request_with([user_message()], context), marketing_assistant=marketing_assistant)

    assert marketing_assistant.contexts[0][5] == "Posted about the Margherita pizza."


async def test_sends_no_activity_summary_when_absent(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    await chat(request_with([user_message()]), marketing_assistant=marketing_assistant)

    assert marketing_assistant.contexts[0][5] is None


async def test_sends_the_full_history_when_under_the_cap(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    messages = [user_message(f"Message {i}") for i in range(5)]

    await chat(request_with(messages), marketing_assistant=marketing_assistant)

    assert marketing_assistant.calls == [messages]


async def test_caps_the_history_sent_to_the_provider(
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    """The service caps how many prior turns are actually sent, even when the
    caller has more - see MAX_HISTORY_MESSAGES for the reasoning."""
    messages = [user_message(f"Message {i}") for i in range(MAX_HISTORY_MESSAGES + 10)]

    await chat(request_with(messages), marketing_assistant=marketing_assistant)

    sent = marketing_assistant.calls[0]
    assert len(sent) == MAX_HISTORY_MESSAGES
    # The most recent messages, not the oldest.
    assert sent == messages[-MAX_HISTORY_MESSAGES:]
    assert sent[-1].content == f"Message {MAX_HISTORY_MESSAGES + 9}"


async def test_the_cap_is_inclusive(marketing_assistant: RecordingMarketingAssistant) -> None:
    messages = [user_message(f"Message {i}") for i in range(MAX_HISTORY_MESSAGES)]

    await chat(request_with(messages), marketing_assistant=marketing_assistant)

    assert len(marketing_assistant.calls[0]) == MAX_HISTORY_MESSAGES


async def test_propagates_a_busy_provider() -> None:
    busy = RecordingMarketingAssistant(error=AIServiceBusyError("AI service is temporarily busy."))

    with pytest.raises(AIServiceBusyError):
        await chat(request_with([user_message()]), marketing_assistant=busy)


async def test_an_empty_reply_raises_a_malformed_error() -> None:
    empty = RecordingMarketingAssistant(result="")

    with pytest.raises(AIResponseMalformedError, match="empty reply"):
        await chat(request_with([user_message()]), marketing_assistant=empty)


async def test_a_whitespace_only_reply_raises_a_malformed_error() -> None:
    blank = RecordingMarketingAssistant(result="   \n  ")

    with pytest.raises(AIResponseMalformedError, match="empty reply"):
        await chat(request_with([user_message()]), marketing_assistant=blank)


async def test_the_reply_is_stripped(marketing_assistant: RecordingMarketingAssistant) -> None:
    marketing_assistant.result = "  Post your special today.  "

    result = await chat(request_with([user_message()]), marketing_assistant=marketing_assistant)

    assert result.reply == "Post your special today."
