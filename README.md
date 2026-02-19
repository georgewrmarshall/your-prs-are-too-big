# your-prs-are-too-big

A tiny Next.js app that audits a GitHub user's recent public PR sizes.

## Run locally (Yarn)

```bash
corepack enable
yarn install
yarn dev
```

Then open `http://localhost:3000`.

## How it works

- Enter a GitHub username.
- The app fetches recent public PRs for that user via GitHub REST APIs.
- In free/no-login mode, PRs are bucketed using existing PR labels (`size-XS` to `size-XL`).
- Buckets follow the MetaMask thresholds:
  - `xs`: 1-10
  - `sm`: 11-100
  - `md`: 101-500
  - `lg`: 501-1000
  - `xl`: 1001+
- The app flags `YOUR PRS ARE TOO BIG` when `xl > (xs + sm + md + lg)`.
- The "Average changed lines" value is estimated from bucket midpoints.

## GitHub Pages

- Static export is enabled via Next.js `output: "export"`.
- The workflow at `.github/workflows/deploy-pages.yml` builds with Yarn and deploys to Pages on pushes to `main`.
- In repo settings, set Pages source to `GitHub Actions`.

## Notes

- This uses unauthenticated GitHub API calls and can hit rate limits.
- This mode relies on PR size labels. PRs without size labels are ignored.
- Only public pull requests are analyzed.
