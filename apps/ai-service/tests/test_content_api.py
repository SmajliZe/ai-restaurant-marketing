"""HTTP-level rules: upload handling and the status code each failure maps to."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.content_generation.errors import AIServiceBusyError
from app.domain.content_generation.service import MAX_IMAGE_BYTES
from tests.conftest import RecordingCaptionGenerator

ENDPOINT = "/content/generate-caption"


def test_returns_a_caption_for_a_valid_upload(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    response = client.post(ENDPOINT, files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")})

    assert response.status_code == 200
    assert response.json() == {
        "recognized_dish": "Margherita pizza",
        "caption": "Blistered crust and mozzarella that pulls for days.",
        "hashtags": ["margherita", "pizzanight"],
    }
    assert len(caption_generator.calls) == 1


def test_rejects_an_unsupported_content_type(
    client: TestClient,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    response = client.post(ENDPOINT, files={"image": ("notes.txt", b"plain text", "text/plain")})

    assert response.status_code == 422
    assert "text/plain" in response.json()["detail"]
    assert caption_generator.calls == []


def test_accepts_a_content_type_carrying_parameters(
    client: TestClient,
    jpeg_bytes: bytes,
) -> None:
    response = client.post(
        ENDPOINT,
        files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg; charset=binary")},
    )

    assert response.status_code == 200


def test_rejects_an_upload_over_the_size_limit(
    client: TestClient,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    oversized = b"\x00" * (MAX_IMAGE_BYTES + 1)

    response = client.post(ENDPOINT, files={"image": ("big.jpg", oversized, "image/jpeg")})

    assert response.status_code == 422
    assert "larger than 10 MB" in response.json()["detail"]
    assert caption_generator.calls == []


def test_rejects_a_file_that_lies_about_its_content_type(
    client: TestClient,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    """A declared type is not proof, so the bytes are checked as well."""
    response = client.post(ENDPOINT, files={"image": ("dish.jpg", b"not an image", "image/jpeg")})

    assert response.status_code == 422
    assert "not a readable image" in response.json()["detail"]
    assert caption_generator.calls == []


def test_rejects_a_request_without_a_file(client: TestClient) -> None:
    response = client.post(ENDPOINT)

    assert response.status_code == 422
    # Framework validation is reshaped to match the documented error body, so
    # "detail" is a string here just as it is for every other failure.
    assert response.json() == {"detail": "image: Field required"}


def test_reports_a_busy_provider_as_retryable(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    message = "AI service is temporarily busy, please try again in a moment."
    caption_generator.error = AIServiceBusyError(message)

    response = client.post(ENDPOINT, files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")})

    assert response.status_code == 503
    assert response.json()["detail"] == message
    assert response.headers["Retry-After"] == "30"


def test_reports_an_unusable_provider_response_as_bad_gateway(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    caption_generator.result = {"caption": "The dish name is missing."}

    response = client.post(ENDPOINT, files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")})

    assert response.status_code == 502
    assert "unexpected response" in response.json()["detail"]
