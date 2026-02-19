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
  scope: "metamask";
};

type SearchItem = {
  title: string;
  html_url: string;
  repository_url: string;
  created_at: string;
  labels?: Array<{
    name: string;
  }>;
  pull_request?: {
    url: string;
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

const META_MASK_SIZE_LABEL_TO_BUCKET: Record<string, Bucket> = {
  "size-xs": "xs",
  "size-s": "sm",
  "size-m": "md",
  "size-l": "lg",
  "size-xl": "xl"
};

const BUCKET_ESTIMATED_LINES: Record<Bucket, number> = {
  xs: 5,
  sm: 55,
  md: 300,
  lg: 750,
  xl: 1250
};

function bucketFromLabels(labels: Array<{ name: string }> | undefined): Bucket | null {
  if (!labels?.length) return null;
  for (const label of labels) {
    const normalized = label.name.trim().toLowerCase();
    const bucket = META_MASK_SIZE_LABEL_TO_BUCKET[normalized];
    if (bucket) return bucket;
  }
  return null;
}

function repoFromUrl(repositoryUrl: string): string {
  try {
    const url = new URL(repositoryUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]}/${parts[1]}`;
    }
  } catch {
    // Fall back when URL parsing fails.
  }
  return repositoryUrl;
}

export async function runPullRequestAudit(username: string): Promise<AuditResult> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Please enter a GitHub username.");
  }

  const searchUrl = new URL("https://api.github.com/search/issues");
  searchUrl.searchParams.set("q", `author:${trimmed} org:MetaMask type:pr is:public is:merged`);
  searchUrl.searchParams.set("sort", "updated");
  searchUrl.searchParams.set("order", "desc");
  searchUrl.searchParams.set("per_page", "100");

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
  const candidateItems = searchData.items.filter((item) => {
    if (!item.pull_request?.url) return false;
    return item.repository_url.includes("/repos/MetaMask/");
  });
  if (!candidateItems.length) {
    throw new Error("No public merged PRs found for this user in MetaMask repositories.");
  }

  const summaries = candidateItems.reduce<PullRequestSummary[]>((acc, item) => {
      const bucket = bucketFromLabels(item.labels);
      if (!bucket) return acc;

      acc.push({
        title: item.title,
        url: item.html_url,
        repository: repoFromUrl(item.repository_url),
        linesChanged: BUCKET_ESTIMATED_LINES[bucket],
        createdAt: item.created_at,
        mergedAt: item.created_at
      });
      return acc;
    }, []);

  if (!summaries.length) {
    throw new Error(
      "No PR size labels found on recent PRs. This free mode requires size labels (like size-XS..size-XL)."
    );
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

  const xlRatio = buckets.xl / totalPrs;
  const largeRatio = (buckets.lg + buckets.xl) / totalPrs;
  const tooBig = xlRatio >= 0.15 || largeRatio >= 0.4;

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
    reason,
    scope: "metamask"
  };
}
