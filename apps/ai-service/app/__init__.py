"""AI service package.

Layering rule for everything below this package:

    api -> domain -> (ports)
    infrastructure -> domain

`domain` never imports from `api` or `infrastructure`, which keeps the
dependency graph acyclic and the business rules independent of FastAPI.
"""
