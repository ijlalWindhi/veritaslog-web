"use client";

import { useEffect, useState } from "react";
import { suiClient } from "@/lib/sui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Shield,
  Clock,
  AlertTriangle,
  FileText,
  Lock,
  CheckCircle,
  Zap,
  ChevronRight,
} from "lucide-react";
import { useUserStore } from "@/stores/use-user";

type LogEvent = {
  logId: string;
  walrusCid: string;
  createdAt: number;
  severityCode: number;
  commitment: number[];
  owner: string;
  txDigest: string;
};

const SEVERITY_MAP: Record<
  number,
  { label: string; color: string; icon: string; badgeClass: string }
> = {
  0: {
    label: "LOW",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
    icon: "🟢",
    badgeClass: "severity-badge-low",
  },
  1: {
    label: "MEDIUM",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: "🟡",
    badgeClass: "severity-badge-medium",
  },
  2: {
    label: "HIGH",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: "🔴",
    badgeClass: "severity-badge-high",
  },
};

export default function LogsListPage() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<number | null>(null);
  const { role } = useUserStore();

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    try {
      setLoading(true);
      setError(null);

      const packageId = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID;
      if (!packageId) {
        throw new Error("NEXT_PUBLIC_SUI_PACKAGE_ID not set");
      }

      // Query RegisterLogEvent dari contract
      const events = await suiClient.queryEvents({
        query: {
          MoveEventType: `${packageId}::registry::RegisterLogEvent`,
        },
        limit: 100,
        order: "descending",
      });

      const parsedLogs: LogEvent[] = events.data.map((event) => {
        const parsed = event.parsedJson as {
          log_id: string;
          walrus_cid: string;
          created_at: string;
          severity_code: string;
          commitment: number[];
          owner: string;
        };
        return {
          logId: parsed.log_id,
          walrusCid: parsed.walrus_cid,
          createdAt: Number(parsed.created_at),
          severityCode: Number(parsed.severity_code),
          commitment: parsed.commitment,
          owner: parsed.owner,
          txDigest: event.id.txDigest,
        };
      });

      setLogs(parsedLogs);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs =
    filterSeverity !== null
      ? logs.filter((log) => log.severityCode === filterSeverity)
      : logs;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="flex h-96 items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full border-2 border-border border-t-primary h-12 w-12" />
              <span className="text-muted-foreground">
                Loading logs from blockchain...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">
                  Error Loading Logs
                </h3>
                <p className="text-destructive/80 text-sm mb-4">{error}</p>
                <button
                  onClick={fetchLogs}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header with branding */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Compliance Log
              </h1>
              <p className="text-xs text-muted-foreground">
                Selective Disclosure
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Role</p>
            <p className="text-sm font-semibold text-primary">
              {role?.replace("_", " ") || "Auditor"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-12">
        {/* Hero Section */}
        <section className="mb-12">
          <div className="rounded-lg border border-border/50 bg-gradient-to-br from-card/50 to-card/30 backdrop-blur-sm p-8 mb-8">
            <div className="max-w-3xl">
              <h2 className="text-3xl font-bold mb-3 text-balance">
                Compliance Log with Selective Disclosure
              </h2>
              <p className="text-muted-foreground mb-4">
                Privacy-preserving audit trail with verifiable integrity.
                Encrypted payloads stored on Walrus, access control on Sui, and
                integrity verified via Seal.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="badge-protocol badge-privacy">
                  🔐 Privacy-First
                </span>
                <span className="badge-protocol badge-verify">
                  ✓ Verifiable
                </span>
                <span className="badge-protocol badge-compliance">
                  📋 Audit-Ready
                </span>
              </div>
            </div>
          </div>

          {/* Three Pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="pillar-card">
              <div className="pillar-icon">🔒</div>
              <h3 className="font-semibold text-base mb-2 text-blue-300">
                Privacy
              </h3>
              <p className="text-xs text-muted-foreground">
                Log contents encrypted and disclosed only to approved parties
                via selective revelation.
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                Powered by Walrus
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">✓</div>
              <h3 className="font-semibold text-base mb-2 text-emerald-300">
                Verifiability
              </h3>
              <p className="text-xs text-muted-foreground">
                On-chain pointers and hashes ensure logs haven&apos;t been
                tampered with or modified.
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                Powered by Seal
              </div>
            </div>

            <div className="pillar-card">
              <div className="pillar-icon">📊</div>
              <h3 className="font-semibold text-base mb-2 text-purple-300">
                Compliance
              </h3>
              <p className="text-xs text-muted-foreground">
                Metadata indexed and searchable by severity, date, and module
                without exposing content.
              </p>
              <div className="mt-3 text-xs text-muted-foreground">
                Powered by Nautilus
              </div>
            </div>
          </div>
        </section>

        {/* Lifecycle Pipeline */}
        <section className="mb-8">
          <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-6">
            <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">
              Log Lifecycle
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                1. Upload
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                2. Encrypt
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                3. Walrus Store
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                4. Record on Sui
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                5. Index in Nautilus
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                6. Verify via Seal
              </span>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="mb-8">
          <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-6">
            <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">
              Filter by Severity
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setFilterSeverity(null)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterSeverity === null
                    ? "bg-primary text-primary-foreground border border-primary shadow-lg shadow-primary/20"
                    : "bg-muted text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span>All Logs</span>
                <span className="text-xs font-mono opacity-70">
                  ({logs.length})
                </span>
              </button>
              {[2, 1, 0].map((sev) => {
                const count = logs.filter((l) => l.severityCode === sev).length;
                const severity = SEVERITY_MAP[sev];
                return (
                  <button
                    key={sev}
                    onClick={() => setFilterSeverity(sev)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all badge-protocol ${
                      filterSeverity === sev
                        ? `${severity.badgeClass} shadow-lg`
                        : `${severity.badgeClass} opacity-60 hover:opacity-100`
                    }`}
                  >
                    <span>{severity.icon}</span>
                    <span>{severity.label}</span>
                    <span className="text-xs opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Total Logs
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    {logs.length}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-primary/40" />
              </div>
            </div>

            {[2, 1, 0].map((sev) => {
              const severity = SEVERITY_MAP[sev];
              const count = logs.filter((l) => l.severityCode === sev).length;
              const iconMap = {
                0: "🟢",
                1: "🟡",
                2: "🔴",
              };
              return (
                <div
                  key={sev}
                  className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                        {severity.label} Severity
                      </p>
                      <p className="text-3xl font-bold text-foreground">
                        {count}
                      </p>
                    </div>
                    <span className="text-2xl opacity-60">
                      {iconMap[sev as keyof typeof iconMap]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Logs List */}
        <section>
          <h3 className="font-semibold text-sm mb-4 text-muted-foreground uppercase tracking-wide">
            Audit Log Registry ({filteredLogs.length})
          </h3>

          {filteredLogs.length === 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm p-12 text-center">
              <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/40" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No logs found
              </h3>
              <p className="text-muted-foreground">
                {filterSeverity !== null
                  ? `No logs with ${SEVERITY_MAP[filterSeverity].label} severity`
                  : "No logs have been registered yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const severity = SEVERITY_MAP[log.severityCode];
                console.log(log.createdAt);
                const date = new Date(log.createdAt * 1000);
                const commitmentHex = log.commitment
                  .slice(0, 8)
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("");

                return (
                  <Link
                    key={log.logId}
                    href={`/logs/${log.logId}`}
                    className="group block rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 hover:border-primary/50 transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              Log #{log.logId}
                            </span>
                            <span
                              className={`badge-protocol ${severity.badgeClass} font-semibold`}
                            >
                              {severity.icon} {severity.label}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>
                                {date.toLocaleString()} •{" "}
                                {formatDistanceToNow(date, { addSuffix: true })}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <CheckCircle className="h-4 w-4" />
                              <span className="font-mono">
                                Commitment: {commitmentHex}...
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Lock className="h-4 w-4" />
                              <span className="font-mono">
                                Owner: {log.owner.slice(0, 8)}...
                                {log.owner.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                            <Zap className="h-3 w-3" />
                            <span className="text-xs font-medium">Stored</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>

                      <div className="border-t border-border/30 pt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground font-mono">
                          <span>Walrus CID</span>
                          <span className="text-primary">→</span>
                          <span className="truncate">
                            {log.walrusCid.slice(0, 16)}...
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Verify via Seal
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
