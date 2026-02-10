# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-09

### Added
- **Productization**: Defined core product boundaries (`PRODUCT_SCOPE.md`).
- **Onboarding**: Automated organization setup with `OnboardingService`.
- **Permissions**: Centralized role enforcement via `PermissionService`.
- **Limits**: Technical plan enforcement (Starter/Pro/Enterprise) via `LimitService`.
- **Observability**: Structured JSON logging and correlation IDs.
- **Resilience**: Circuit breakers and retries for external APIs.

### Changed
- **Claims**: Refactored to Service Pattern with strict lifecycle events.
- **Payments**: Integrated Stripe Checkout with webhook verification.
- **AI**: Hardened "Adam" with stage-awareness and litigation guardrails.

### Fixed
- Deployment issues on Render (environment variable mismatch).
- Dependency conflict with `pytest-asyncio`.

## [0.9.0] - 2026-02-01
### Added
- Initial beta release of Eden.
- Basic claims management.
- Google Calendar integration.
