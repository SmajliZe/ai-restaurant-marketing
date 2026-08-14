"""HTTP-level rules for the assistant endpoint: no upload involved, so no
413/415 - otherwise the same status-code-per-failure pattern as
/calendar/generate.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.content_generation.errors import (
    AIRefusalError,
    AIResponseMalformedError,
    AIServiceBusyError,
    AITimeoutError,
)
from tests.conftest import RecordingMarketingAssistant

ENDPOINT = "/assistant/chat"


def _body(content: str = "What should I post today?", **context: object) -> dict[str, object]:
    return {
        "messages": [{"role": "user", "content": content}],
        "context": context,
    }


def test_returns_the_reply(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 200
    assert response.json()["reply"] == marketing_assistant.result


def test_rejects_a_request_with_no_messages(client: TestClient) -> None:
    response = client.post(ENDPOINT, json={"messages": [], "context": {}})

    assert response.status_code == 422
    assert "detail" in response.json()


def test_rejects_a_request_missing_the_context_field(client: TestClient) -> None:
    response = client.post(ENDPOINT, json={"messages": [{"role": "user", "content": "Hi"}]})

    assert response.status_code == 422


def test_rejects_a_message_with_an_invalid_role(client: TestClient) -> None:
    response = client.post(
        ENDPOINT,
        json={"messages": [{"role": "system", "content": "Hi"}], "context": {}},
    )

    assert response.status_code == 422


def test_rejects_a_blank_message(client: TestClient) -> None:
    response = client.post(
        ENDPOINT,
        json={"messages": [{"role": "user", "content": ""}], "context": {}},
    )

    assert response.status_code == 422


def test_reports_a_busy_provider_as_retryable(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    message = "AI service is temporarily busy, please try again in a moment."
    marketing_assistant.error = AIServiceBusyError(message)

    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 503
    assert response.json()["detail"] == message
    assert response.headers["Retry-After"] == "30"


def test_reports_an_empty_reply_as_bad_gateway(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    marketing_assistant.result = ""

    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 502
    assert "empty reply" in response.json()["detail"]


def test_reports_a_malformed_response_as_bad_gateway(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    marketing_assistant.error = AIResponseMalformedError(
        "The AI service returned an unexpected response."
    )

    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 502


def test_reports_a_refusal_as_bad_gateway(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    marketing_assistant.error = AIRefusalError("The AI service declined to reply.")

    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 502


def test_reports_a_timeout_as_gateway_timeout(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    marketing_assistant.error = AITimeoutError("The AI service took too long to respond.")

    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 504


def test_documents_every_status_code_it_can_return(client: TestClient) -> None:
    """No 413/415 here: there is no upload, so neither failure mode applies."""
    responses = client.get("/openapi.json").json()["paths"][ENDPOINT]["post"]["responses"]

    assert sorted(responses) == ["200", "422", "502", "503", "504"]
    for code in ("422", "502", "503", "504"):
        schema = responses[code]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith("/ErrorResponse"), code


def test_forwards_the_restaurant_context_and_history_from_the_body(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    response = client.post(
        ENDPOINT,
        json={
            "messages": [
                {"role": "user", "content": "What should I post today?"},
                {"role": "assistant", "content": "Try a weekend special."},
                {"role": "user", "content": "Give me an example."},
            ],
            "context": {
                "tone_of_voice": "luxury",
                "cuisine_type": "Neapolitan pizza",
                "country": "Italy",
                "language": "German",
                "target_audience": "young professionals",
                "activity_summary": "Recently posted about the Margherita pizza.",
            },
        },
    )

    assert response.status_code == 200
    assert marketing_assistant.contexts == [
        (
            "luxury",
            "Neapolitan pizza",
            "Italy",
            "German",
            "young professionals",
            "Recently posted about the Margherita pizza.",
        )
    ]
    assert [message.content for message in marketing_assistant.calls[0]] == [
        "What should I post today?",
        "Try a weekend special.",
        "Give me an example.",
    ]


def test_the_restaurant_context_is_optional(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    """The service stays callable on its own, without a profile behind it."""
    response = client.post(ENDPOINT, json=_body())

    assert response.status_code == 200
    assert marketing_assistant.contexts == [(None, None, None, None, None, None)]


def test_empty_context_fields_count_as_absent(
    client: TestClient,
    marketing_assistant: RecordingMarketingAssistant,
) -> None:
    response = client.post(
        ENDPOINT,
        json={
            "messages": [{"role": "user", "content": "Hi"}],
            "context": {
                "tone_of_voice": "",
                "cuisine_type": "   ",
                "country": "",
                "language": "   ",
                "target_audience": "",
                "activity_summary": "   ",
            },
        },
    )

    assert response.status_code == 200
    assert marketing_assistant.contexts == [(None, None, None, None, None, None)]


def test_documents_the_request_shape(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    body = spec["paths"][ENDPOINT]["post"]["requestBody"]
    reference = body["content"]["application/json"]["schema"]["$ref"]
    schema = spec["components"]["schemas"][reference.rsplit("/", 1)[-1]]

    assert set(schema["properties"]) == {"messages", "context"}
    assert schema["required"] == ["messages", "context"]
