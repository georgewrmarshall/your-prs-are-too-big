"use client";

import { FormEvent, useMemo, useState } from "react";
import { bucketLabels, runPullRequestAudit, type AuditResult, type Bucket } from "@/lib/prAudit";

const orderedBuckets: Bucket[] = ["xs", "sm", "md", "lg", "xl"];

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
    return audit.verdict === "too-big"
      ? "text-[clamp(2.2rem,7vw,5rem)] text-warn animate-warning-pop"
      : "text-[clamp(2.2rem,7vw,5rem)] text-ok";
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

  const heading = audit
    ? audit.verdict === "too-big"
      ? "YOUR PRS ARE TOO BIG"
      : "YOUR PRS AREN'T TOO BIG"
    : "Are your PRs reviewable?";

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-[848px] rounded-[20px] border-2 border-[var(--color-border)] bg-[var(--color-panel)] p-6 shadow-[8px_8px_0_var(--color-border)] animate-card-in">
        <h1
          className={`m-0 text-[clamp(1.9rem,4vw,3.1rem)] leading-none tracking-[0.03em] uppercase ${titleClass}`}
        >
          {heading}
        </h1>
        <p className="mt-2 mb-6 text-base">
          Type a GitHub username. We inspect recent public PRs in MetaMask repositories and judge
          whether your code habits are disciplined or absolute chaos.
        </p>

        <form className="flex flex-wrap gap-3" onSubmit={onSubmit}>
          <input
            className="min-w-[260px] flex-1 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="github username"
            autoComplete="off"
          />
          <button
            className="cursor-pointer rounded-full border-2 border-[var(--color-border)] bg-[var(--color-button-bg)] px-6 py-3 font-bold text-[var(--color-button-fg)] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Auditing..." : "Run PR Audit"}
          </button>
        </form>

        {error ? <div className="mt-3 font-semibold text-warn">{error}</div> : null}

        {audit ? (
          <>
            <div className="mt-5 flex flex-wrap gap-3">
              <span className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">User: @{audit.username}</span>
              <span className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">Scope: MetaMask org</span>
              <span className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">PRs audited: {audit.totalPrs}</span>
              <span className="rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                Average changed lines (est.): {audit.averageSize}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(152px,1fr))] gap-3">
              {orderedBuckets.map((bucket) => (
                <div
                  className="rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)] p-3 [animation:card-in_460ms_ease-out_both]"
                  key={bucket}
                >
                  <span>{bucketLabels[bucket]}</span>
                  <strong className="block text-[1.2rem]">{audit.buckets[bucket]}</strong>
                </div>
              ))}
            </div>

            <p
              className={`mt-4 font-semibold ${audit.verdict === "too-big" ? "text-warn" : "text-ok"}`}
            >
              {audit.reason}
            </p>

            <div className="mt-6 overflow-hidden rounded-xl border-2 border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="pr-list-scroll max-h-[240px] overflow-auto p-2 pr-1">
                {audit.prs.slice(0, 20).map((pr) => (
                  <article className="rounded-lg border-t border-t-[var(--color-border)] p-2 first:border-t-0" key={pr.url}>
                    <a className="font-semibold text-ink" href={pr.url} target="_blank" rel="noreferrer">
                      {pr.title}
                    </a>
                    <div className="text-sm text-[var(--color-muted)]">
                      {pr.repository} • {pr.linesChanged} lines • {prettyDate(pr.createdAt)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
