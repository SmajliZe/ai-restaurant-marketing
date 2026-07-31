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

    assert response.status_code == 415
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

    assert response.status_code == 413
    assert "larger than 10 MB" in response.json()["detail"]
    assert caption_generator.calls == []


def test_rejects_a_file_that_lies_about_its_content_type(
    client: TestClient,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    """A declared type is not proof, so the bytes are checked as well.

    Rejected as 415 like any other unsupported format: what the client called
    the upload does not change what it actually is.
    """
    response = client.post(ENDPOINT, files={"image": ("dish.jpg", b"not an image", "image/jpeg")})

    assert response.status_code == 415
    assert "not a readable image" in response.json()["detail"]
    assert caption_generator.calls == []


def test_rejects_a_request_without_a_file(client: TestClient) -> None:
    """The only 422 the endpoint returns: nothing is wrong with the media type,
    the field is simply absent."""
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


def test_documents_every_status_code_it_can_return(client: TestClient) -> None:
    """A client generating types from the spec would otherwise never learn that
    413 and 415 exist, and would treat them as unexpected."""
    responses = client.get("/openapi.json").json()["paths"][ENDPOINT]["post"]["responses"]

    assert sorted(responses) == ["200", "413", "415", "422", "502", "503"]
    for code in ("413", "415", "422", "502", "503"):
        schema = responses[code]["content"]["application/json"]["schema"]
        assert schema["$ref"].endswith("/ErrorResponse"), code


def test_forwards_the_restaurant_context_from_the_form(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    response = client.post(
        ENDPOINT,
        files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")},
        data={"tone_of_voice": "luxury", "cuisine_type": "Neapolitan pizza"},
    )

    assert response.status_code == 200
    assert caption_generator.contexts == [("luxury", "Neapolitan pizza")]


def test_the_restaurant_context_is_optional(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    """The service stays callable on its own, without a profile behind it."""
    response = client.post(ENDPOINT, files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")})

    assert response.status_code == 200
    assert caption_generator.contexts == [(None, None)]


def test_empty_context_fields_count_as_absent(
    client: TestClient,
    jpeg_bytes: bytes,
    caption_generator: RecordingCaptionGenerator,
) -> None:
    response = client.post(
        ENDPOINT,
        files={"image": ("dish.jpg", jpeg_bytes, "image/jpeg")},
        data={"tone_of_voice": "", "cuisine_type": "   "},
    )

    assert response.status_code == 200
    assert caption_generator.contexts == [(None, None)]


def test_documents_the_context_fields_as_optional(client: TestClient) -> None:
    spec = client.get("/openapi.json").json()
    body = spec["paths"][ENDPOINT]["post"]["requestBody"]
    reference = body["content"]["multipart/form-data"]["schema"]["$ref"]
    schema = spec["components"]["schemas"][reference.rsplit("/", 1)[-1]]

    assert set(schema["properties"]) == {"image", "tone_of_voice", "cuisine_type"}
    # Only the photo is required; a caller with no profile can still call this.
    assert schema["required"] == ["image"]
