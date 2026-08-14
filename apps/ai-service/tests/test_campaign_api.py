"""HTTP-level rules for the campaign endpoint: no upload involved, so no
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
from tests.conftest import RecordingCampaignGenerator

ENDPOINT = "/campaign/generate"


def test_returns_the_full_campaign(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Aperitivo Hour"
    assert body["story"]["sticker_type"] == "countdown"
    assert body["duration_suggestion"] == "Every weekday, 5-7pm"
    assert campaign_generator.occasions == ["Happy Hour"]


def test_rejects_a_request_without_an_occasion(client: TestClient) -> None:
    """The one case where 422 is guaranteed: occasion is the only required field."""
    response = client.post(ENDPOINT, json={})

    assert response.status_code == 422
    assert "detail" in response.json()


def test_rejects_a_blank_occasion(client: TestClient) -> None:
    response = client.post(ENDPOINT, json={"occasion": "   "})

    assert response.status_code == 422


def test_rejects_a_request_body_with_the_wrong_type(client: TestClient) -> None:
    response = client.post(ENDPOINT, json={"occasion": "Happy Hour", "tone_of_voice": 123})

    assert response.status_code == 422


def test_reports_a_busy_provider_as_retryable(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    message = "AI service is temporarily busy, please try again in a moment."
    campaign_generator.error = AIServiceBusyError(message)

    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 503
    assert response.json()["detail"] == message
    assert response.headers["Retry-After"] == "30"


def test_reports_an_unusable_provider_response_as_bad_gateway(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    campaign_generator.result = {"name": "Only a name, nothing else."}

    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 502
    assert "missing" in response.json()["detail"]


def test_reports_a_malformed_response_as_bad_gateway(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    campaign_generator.error = AIResponseMalformedError(
        "The AI service returned an unexpected response."
    )

    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 502


def test_reports_a_refusal_as_bad_gateway(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    campaign_generator.error = AIRefusalError("The AI service declined to build a campaign.")

    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 502


def test_reports_a_timeout_as_gateway_timeout(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    campaign_generator.error = AITimeoutError("The AI service took too long to respond.")

    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 504


def test_documents_every_status_code_it_can_return(client: TestClient) -> None:
    """No 413/415 here: there is no upload, so neither failure mode applies."""
    responses = client.get("/openapi.json").json()["paths"][ENDPOINT]["post"]["responses"]

    assert sorted(responses) == ["200", "422", "502", "503", "504"]
    for code in ("422", "502", "503", "504"):
        schema = responses[code]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith("/ErrorResponse"), code


def test_forwards_the_restaurant_context_from_the_body(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    response = client.post(
        ENDPOINT,
        json={
            "occasion": "Pizza Day",
            "tone_of_voice": "luxury",
            "cuisine_type": "Neapolitan pizza",
            "country": "Italy",
            "language": "German",
            "target_audience": "young professionals",
        },
    )

    assert response.status_code == 200
    assert campaign_generator.occasions == ["Pizza Day"]
    assert campaign_generator.contexts == [
        ("luxury", "Neapolitan pizza", "Italy", "German", "young professionals")
    ]


def test_the_restaurant_context_is_optional(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    """The service stays callable on its own, without a profile behind it."""
    response = client.post(ENDPOINT, json={"occasion": "Happy Hour"})

    assert response.status_code == 200
    assert campaign_generator.contexts == [(None, None, None, None, None)]


def test_empty_context_fields_count_as_absent(
    client: TestClient,
    campaign_generator: RecordingCampaignGenerator,
) -> None:
    response = client.post(
        ENDPOINT,
        json={
            "occasion": "Happy Hour",
            "tone_of_voice": "",
            "cuisine_type": "   ",
            "country": "",
            "language": "   ",
            "target_audience": "",
        },
    )

    assert response.status_code == 200
    assert campaign_generator.contexts == [(None, None, None, None, None)]


def test_documents_the_request_fields(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    body = spec["paths"][ENDPOINT]["post"]["requestBody"]
    reference = body["content"]["application/json"]["schema"]["$ref"]
    schema = spec["components"]["schemas"][reference.rsplit("/", 1)[-1]]

    assert set(schema["properties"]) == {
        "occasion",
        "tone_of_voice",
        "cuisine_type",
        "country",
        "language",
        "target_audience",
    }
    # Only the occasion is required; a caller with no profile can still call this.
    assert schema["required"] == ["occasion"]
