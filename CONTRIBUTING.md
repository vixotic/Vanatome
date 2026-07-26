# Contributing to Vanatome

Thank you for helping make human anatomy easier to explore.

## Before opening a change

Use an issue for substantial product behavior, new atlas layers, or changes to
the public package contract. Small fixes and documentation improvements can go
directly to a pull request.

## Local setup

```bash
npm install
npm run dev
```

Before submitting:

```bash
npm run lint
npm run package:check
npm test
```

Keep viewer code static and frontend-friendly. Do not add backend, account,
analytics, or paid-service requirements. Preserve stable structure IDs and
document public contract changes.

## Atlas contributions

Every model, texture, definition, or metadata contribution must include its
source, author or creator attribution, license, and a concise description of
modifications. Do not submit assets when their license is unknown or
incompatible with redistribution.

Z-Anatomy-derived material must retain the applicable CC BY-SA 4.0 attribution
and ShareAlike obligations described in `ASSET-LICENSE.md`.

## Pull requests

- Keep changes focused and explain the user-facing outcome.
- Add or update checks for public behavior and data contracts.
- Run the relevant validation commands and report their results.
- Do not commit generated build output, local environment files, or conversion
  scratch data.
