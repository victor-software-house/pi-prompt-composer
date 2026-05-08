Prepare command batch for operator review.

```bash
cd 'packages/app with spaces'
pnpm install
pnpm test -- --runInBand
git status --short
printf '%s\n' 'release candidate'"'"'s notes'
```

Rules:
- Do not execute until operator confirms.
- Preserve command order.
- Stop on first failure when converting to an executable script.