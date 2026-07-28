// Public surface of the package. Consumers import from
// '@restaurant-ai/shared-types' only - never from a deep path - so the internal
// file layout can change without breaking them.
//
// Ships uncompiled TypeScript on purpose: the package is type-only, and Next
// compiles it via `transpilePackages`, which removes a build step and the class
// of bugs where a stale dist/ shadows the source.

export {};
