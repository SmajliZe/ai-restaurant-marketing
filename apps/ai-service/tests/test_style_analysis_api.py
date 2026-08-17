"""HTTP-level rules: multipart field grouping, upload handling, and the
status code each failure maps to.

Reuses app.api.upload's per-image validation, the same as content.py and
menu_analysis.py, so the image-handling cases mirror test_content_api.py's;
this file also covers the fields specific to style analysis's own
multi-profile, multi-image shape.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.content_generation.errors import (
    AIRefusalError,
    AIResponseMalformedError,
    AIServiceBusyError,
    AITimeoutError,
)
from app.domain.content_generation.service import MAX_IMAGE_BYTES
from tests.conftest import RecordingStyleAnalyzer, make_image

ENDPOINT = "/style-analysis/analyze"


def _files(**named_images: bytes) -> dict[str, tuple[str, bytes, str]]:
    return {name: (f"{name}.jpg", data, "image/jpeg") for name, data in named_images.items()}


def test_returns_a_plan_for_a_single_profile(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 200
    body = response.json()
    assert body["visual_style_notes"].startswith("References lean on warm")
    assert len(body["content_pillars"]) == 3
    assert len(style_analyzer.calls) == 1


def test_rejects_a_request_with_zero_images(client: TestClient) -> None:
    response = client.post(ENDPOINT, data={"cuisine_type": "Neapolitan pizza"})

    assert response.status_code == 422
    assert "At least one reference image is required" in response.json()["detail"]


def test_groups_images_across_multiple_profiles_before_reaching_the_domain_layer(
    client: TestClient,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files=_files(
            profile_1_feed=make_image("JPEG"),
            profile_1_post_1=make_image("PNG"),
            profile_2_post_1=make_image("JPEG"),
            profile_2_post_2=make_image("WEBP"),
        ),
    )

    assert response.status_code == 200
    [sent_profiles] = style_analyzer.calls
    # Only the two profiles that actually got an image - an empty profile 3
    # slot contributes nothing, so it is not sent as an empty group.
    assert len(sent_profiles) == 2
    assert sent_profiles[0].feed is not None
    assert len(sent_profiles[0].posts) == 1
    assert sent_profiles[1].feed is None
    assert len(sent_profiles[1].posts) == 2


def test_a_profile_with_only_post_images_is_still_included(
    client: TestClient,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(ENDPOINT, files=_files(profile_1_post_1=make_image()))

    assert response.status_code == 200
    [sent_profiles] = style_analyzer.calls
    assert len(sent_profiles) == 1
    assert sent_profiles[0].feed is None
    assert len(sent_profiles[0].posts) == 1


def test_rejects_an_unsupported_content_type(
    client: TestClient,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files={"profile_1_feed": ("notes.txt", b"plain text", "text/plain")},
    )

    assert response.status_code == 415
    assert "text/plain" in response.json()["detail"]
    assert style_analyzer.calls == []


def test_rejects_an_upload_over_the_size_limit(
    client: TestClient,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    response = client.post(ENDPOINT, files=_files(profile_1_feed=oversized))

    assert response.status_code == 413
    assert "larger than 10 MB" in response.json()["detail"]
    assert style_analyzer.calls == []


def test_rejects_a_file_that_lies_about_its_content_type(
    client: TestClient,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files={"profile_1_feed": ("feed.jpg", b"not an image", "image/jpeg")},
    )

    assert response.status_code == 415
    assert "not a readable image" in response.json()["detail"]
    assert style_analyzer.calls == []


def test_rejects_a_bad_post_image_even_when_the_feed_is_fine(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files={
            "profile_1_feed": ("feed.jpg", jpeg_bytes, "image/jpeg"),
            "profile_1_post_1": ("post.jpg", b"not an image", "image/jpeg"),
        },
    )

    assert response.status_code == 415
    assert style_analyzer.calls == []


def test_reports_a_busy_provider_as_retryable(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    message = "AI service is temporarily busy, please try again in a moment."
    style_analyzer.error = AIServiceBusyError(message)

    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 503
    assert response.json()["detail"] == message
    assert response.headers["Retry-After"] == "30"


def test_reports_an_unusable_provider_response_as_bad_gateway(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    style_analyzer.result = {"visual_style_notes": "Only one field, nothing else."}

    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 502
    assert "missing" in response.json()["detail"]


def test_reports_a_malformed_response_as_bad_gateway(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    style_analyzer.error = AIResponseMalformedError(
        "The AI service returned an unexpected response."
    )

    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 502


def test_reports_a_refusal_as_bad_gateway(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    style_analyzer.error = AIRefusalError(
        "The AI service declined to analyze these reference profiles."
    )

    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 502


def test_reports_a_timeout_as_gateway_timeout(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    style_analyzer.error = AITimeoutError("The AI service took too long to respond.")

    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 504


def test_documents_every_status_code_it_can_return(client: TestClient) -> None:
    responses = client.get("/openapi.json").json()["paths"][ENDPOINT]["post"]["responses"]

    assert sorted(responses) == ["200", "413", "415", "422", "502", "503", "504"]
    for code in ("413", "415", "422", "502", "503", "504"):
        schema = responses[code]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith("/ErrorResponse"), code


def test_forwards_the_restaurant_context_from_the_form(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files=_files(profile_1_feed=jpeg_bytes),
        data={
            "cuisine_type": "Neapolitan pizza",
            "tone_of_voice": "luxury",
            "country": "Italy",
            "language": "German",
            "target_audience": "young professionals",
        },
    )

    assert response.status_code == 200
    assert style_analyzer.contexts == [
        ("Neapolitan pizza", "luxury", "Italy", "German", "young professionals")
    ]


def test_the_restaurant_context_is_optional(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(ENDPOINT, files=_files(profile_1_feed=jpeg_bytes))

    assert response.status_code == 200
    assert style_analyzer.contexts == [(None, None, None, None, None)]


def test_empty_context_fields_count_as_absent(
    client: TestClient,
    jpeg_bytes: bytes,
    style_analyzer: RecordingStyleAnalyzer,
) -> None:
    response = client.post(
        ENDPOINT,
        files=_files(profile_1_feed=jpeg_bytes),
        data={
            "cuisine_type": "",
            "tone_of_voice": "   ",
            "country": "",
            "language": "   ",
            "target_audience": "",
        },
    )

    assert response.status_code == 200
    assert style_analyzer.contexts == [(None, None, None, None, None)]


def test_documents_the_request_shape(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    body = spec["paths"][ENDPOINT]["post"]["requestBody"]
    reference = body["content"]["multipart/form-data"]["schema"]["$ref"]
    schema = spec["components"]["schemas"][reference.rsplit("/", 1)[-1]]

    expected_image_fields = {
        f"profile_{profile_index}_{slot}"
        for profile_index in (1, 2, 3)
        for slot in ("feed", "post_1", "post_2", "post_3")
    }
    expected_context_fields = {
        "cuisine_type",
        "tone_of_voice",
        "country",
        "language",
        "target_audience",
    }
    assert set(schema["properties"]) == expected_image_fields | expected_context_fields
    # Every field is individually optional - the "at least one image" rule is
    # enforced in the route, not the schema, since it spans multiple fields.
    assert schema.get("required", []) == []
