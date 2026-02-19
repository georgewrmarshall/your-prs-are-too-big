export type Bucket = "xs" | "sm" | "md" | "lg" | "xl";

export type PullRequestSummary = {
  title: string;
  url: string;
  repository: string;
  linesChanged: number;
  createdAt: string;
  mergedAt: string | null;
};

export type AuditResult = {
  username: string;
  totalPrs: number;
  averageSize: number;
  buckets: Record<Bucket, number>;
  prs: PullRequestSummary[];
  verdict: "good" | "too-big";
  reason: string;
};

type SearchItem = {
  pull_request?: {
    url: string;
  };
};

type PullRequestResponse = {
  title: string;
  html_url: string;
  additions: number;
  deletions: number;
  created_at: string;
  merged_at: string | null;
  base: {
    repo: {
      full_name: string;
    };
  };
};

const BUCKET_RANGES: Record<Bucket, string> = {
  xs: "1-10",
  sm: "11-100",
  md: "101-500",
  lg: "501-1000",
  xl: "1001+"
};

export const bucketLabels: Record<Bucket, string> = {
  xs: `xs: ${BUCKET_RANGES.xs}`,
  sm: `sm: ${BUCKET_RANGES.sm}`,
  md: `md: ${BUCKET_RANGES.md}`,
  lg: `lg: ${BUCKET_RANGES.lg}`,
  xl: `xl: ${BUCKET_RANGES.xl}`
};

function bucketForSize(linesChanged: number): Bucket {
  if (linesChanged <= 10) return "xs";
  if (linesChanged <= 100) return "sm";
  if (linesChanged <= 500) return "md";
  if (linesChanged <= 1000) return "lg";
  return "xl";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runPullRequestAudit(username: string): Promise<AuditResult> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Please enter a GitHub username.");
  }

  const searchUrl = new URL("https://api.github.com/search/issues");
  searchUrl.searchParams.set("q", `author:${trimmed} type:pr is:public is:merged`);
  searchUrl.searchParams.set("sort", "updated");
  searchUrl.searchParams.set("order", "desc");
  searchUrl.searchParams.set("per_page", "30");

  const searchResponse = await fetch(searchUrl.toString(), {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!searchResponse.ok) {
    if (searchResponse.status === 403) {
      throw new Error("GitHub rate limit hit. Try again in a bit.");
    }
    if (searchResponse.status === 422) {
      throw new Error("GitHub username looks invalid.");
    }
    throw new Error("Could not fetch PRs from GitHub.");
  }

  const searchData = (await searchResponse.json()) as { items: SearchItem[] };
  const prDetailUrls = searchData.items
    .map((item) => item.pull_request?.url)
    .filter((url): url is string => Boolean(url));

  if (!prDetailUrls.length) {
    throw new Error("No public PRs found for this username.");
  }

  const prDetails = await mapWithConcurrency(prDetailUrls, 8, async (detailUrl) => {
    const prResponse = await fetch(detailUrl, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });

    if (!prResponse.ok) {
      if (prResponse.status === 403) {
        throw new Error("GitHub rate limit hit while reading PR details.");
      }
      throw new Error("Failed while loading PR details.");
    }

    return (await prResponse.json()) as PullRequestResponse;
  });

  const summaries: PullRequestSummary[] = prDetails
    .map((pr) => {
      const linesChanged = pr.additions + pr.deletions;
      return {
        title: pr.title,
        url: pr.html_url,
        repository: pr.base.repo.full_name,
        linesChanged,
        createdAt: pr.created_at,
        mergedAt: pr.merged_at
      };
    })
    .filter((pr) => pr.linesChanged > 0 && Boolean(pr.mergedAt));

  if (!summaries.length) {
    throw new Error("No measurable PR size data found.");
  }

  const buckets: Record<Bucket, number> = {
    xs: 0,
    sm: 0,
    md: 0,
    lg: 0,
    xl: 0
  };

  let totalLines = 0;
  for (const pr of summaries) {
    totalLines += pr.linesChanged;
    buckets[bucketForSize(pr.linesChanged)] += 1;
  }

  const totalPrs = summaries.length;
  const averageSize = Math.round(totalLines / totalPrs);

  const tooBig = buckets.xl > buckets.xs + buckets.sm + buckets.md + buckets.lg;

  const reason = tooBig
    ? "Your PRs read like a jump-scare novel. Split them up before your reviewers file a missing-person report."
    : "Nice. Your PRs are compact, readable, and only mildly terrifying to reviewers.";

  return {
    username: trimmed,
    totalPrs,
    averageSize,
    buckets,
    prs: summaries,
    verdict: tooBig ? "too-big" : "good",
    reason
  };
}
