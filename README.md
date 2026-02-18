# your-prs-are-too-big

A tiny Next.js app that audits a GitHub user's recent public PR sizes.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## How it works

- Enter a GitHub username.
- The app fetches recent public PRs for that user via GitHub REST APIs.
- Each PR is bucketed by changed lines (`additions + deletions`):
  - `xs`: 1-50
  - `sm`: 51-100
  - `md`: 101-300
  - `lg`: 301-500
  - `xl`: 501-1000
  - `xxl`: 1000+
- The app flags `YOUR PRS ARE TOO BIG` when recent history skews large.

## Notes

- This uses unauthenticated GitHub API calls and can hit rate limits.
- Only public pull requests are analyzed.
