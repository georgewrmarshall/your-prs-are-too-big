"use client";

import { FormEvent, useMemo, useState } from "react";
import { bucketLabels, runPullRequestAudit, type AuditResult, type Bucket } from "@/lib/prAudit";

const orderedBuckets: Bucket[] = ["xs", "sm", "md", "lg", "xl", "xxl"];

function prettyDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [audit, setAudit] = useState<AuditResult | null>(null);

  const titleClass = useMemo(() => {
    if (!audit) return "";
    return audit.verdict === "too-big" ? "too-big" : "";
  }, [audit]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setAudit(null);

    try {
      const result = await runPullRequestAudit(username);
      setAudit(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const heading =
    audit?.verdict === "too-big" ? "YOUR PRS ARE TOO BIG" : "Are your PRs reviewable?";

  return (
    <main>
      <section className="card">
        <h1 className={titleClass}>{heading}</h1>
        <p className="subtitle">
          Enter a GitHub username. We check recent public pull requests and bucket PR size by
          changed lines.
        </p>

        <form className="form-row" onSubmit={onSubmit}>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="github username"
            autoComplete="off"
          />
          <button type="submit" disabled={loading}>
            {loading ? "Auditing..." : "Run PR Audit"}
          </button>
        </form>

        {error ? <div className="error">{error}</div> : null}

        {audit ? (
          <>
            <div className="meta">
              <span className="pill">User: @{audit.username}</span>
              <span className="pill">PRs audited: {audit.totalPrs}</span>
              <span className="pill">Average changed lines: {audit.averageSize}</span>
            </div>

            <div className="bucket-grid">
              {orderedBuckets.map((bucket) => (
                <div className="bucket" key={bucket}>
                  <span>{bucketLabels[bucket]}</span>
                  <strong>{audit.buckets[bucket]}</strong>
                </div>
              ))}
            </div>

            <p className={`message ${audit.verdict === "too-big" ? "bad" : "good"}`}>
              {audit.reason}
            </p>

            <div className="pr-list">
              {audit.prs.slice(0, 20).map((pr) => (
                <article className="pr-row" key={pr.url}>
                  <a href={pr.url} target="_blank" rel="noreferrer">
                    {pr.title}
                  </a>
                  <div className="pr-small">
                    {pr.repository} • {pr.linesChanged} lines • {prettyDate(pr.createdAt)}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
