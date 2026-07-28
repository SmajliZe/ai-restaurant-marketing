"""Pydantic models describing the HTTP contract (request/response shapes).

Kept separate from `domain` so that a wire-format change never forces a change
to the business rules, and vice versa.
"""
