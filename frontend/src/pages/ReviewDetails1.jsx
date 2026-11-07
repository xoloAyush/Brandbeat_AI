
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
    ArrowLeft,
    Download,
    FileText,
    RefreshCw,
    AlertTriangle,
    ShieldCheck,
    Clock,
    CheckCircle2,
    XCircle,
    MessageSquare,
    History,
} from "lucide-react";

import {
    getReviewById,
    downloadReviewArtifact,
    updateFindingDecision,
} from "../services/reviewService";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatDate = (value) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString();
};

const getSeverityStyle = (severity) => {
    const value = String(severity || "").toLowerCase();

    if (value === "critical" || value === "high") {
        return "bg-red-100 text-red-800";
    }

    if (value === "medium") {
        return "bg-amber-100 text-amber-800";
    }

    if (value === "low") {
        return "bg-blue-100 text-blue-800";
    }

    return "bg-slate-100 text-slate-700";
};

const getDecisionStyle = (decision) => {
    const styles = {
        approved: "bg-emerald-100 text-emerald-800",
        rejected: "bg-red-100 text-red-800",
        needs_changes: "bg-amber-100 text-amber-800",
        pending: "bg-slate-100 text-slate-700",
    };

    return styles[decision] || styles.pending;
};

// --------------------------------------------------
// REVIEW DETAILS COMPONENT
// --------------------------------------------------

export default function ReviewDetails() {
    const { id } = useParams();

    const [review, setReview] = useState(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [downloading, setDownloading] = useState("");

    // Human review state
    const [commentDrafts, setCommentDrafts] = useState({});
    const [savingFindingKey, setSavingFindingKey] = useState("");
    const [decisionError, setDecisionError] = useState("");
    const [decisionSuccess, setDecisionSuccess] = useState("");

    // --------------------------------------------------
    // FETCH REVIEW
    // --------------------------------------------------

    const loadReview = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const response = await getReviewById(id);

            const reviewData = response?.data?.review;

            if (!reviewData) {
                throw new Error("Review data was not found.");
            }

            setReview(reviewData);
        } catch (err) {
            console.error("Failed to fetch review:", err);

            setError(
                err.response?.data?.message ||
                err.message ||
                "Unable to load review details."
            );
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        loadReview();
    }, [loadReview]);

    // --------------------------------------------------
    // DOWNLOAD ARTIFACT
    // --------------------------------------------------

    const handleDownload = async (artifact) => {
        try {
            setDownloading(artifact);
            setError("");

            const blob = await downloadReviewArtifact(id, artifact);

            const mimeTypes = {
                reviewed_pdf: "application/pdf",
                json: "application/json",
                markdown: "text/markdown",
            };

            const extensions = {
                reviewed_pdf: "pdf",
                json: "json",
                markdown: "md",
            };

            const url = window.URL.createObjectURL(
                new Blob([blob], {
                    type: mimeTypes[artifact],
                })
            );

            const link = document.createElement("a");

            const originalName = (
                review?.originalName || "compliance-review"
            ).replace(/\.pdf$/i, "");

            link.href = url;
            link.download = `${originalName}-review.${extensions[artifact]}`;

            document.body.appendChild(link);
            link.click();
            link.remove();

            window.setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 1000);

        } catch (err) {
            console.error("Download failed:", err);

            setError(
                err.response?.data?.message ||
                "Unable to download this report. Please try again."
            );
        } finally {
            setDownloading("");
        }
    };

    // --------------------------------------------------
    // UPDATE HUMAN REVIEW DECISION
    // --------------------------------------------------

    const handleFindingDecision = async (findingKey, decision) => {
        const comment = commentDrafts[findingKey] || "";

        if (decision === "needs_changes" && !comment.trim()) {
            setDecisionError(
                "Please provide a comment when requesting changes."
            );
            return;
        }

        try {
            setSavingFindingKey(findingKey);
            setDecisionError("");
            setDecisionSuccess("");

            const response = await updateFindingDecision(
                id,
                findingKey,
                decision,
                comment
            );

            const updatedFinding = response?.data?.finding;

            if (!updatedFinding) {
                throw new Error(
                    "Updated finding was not returned by the server."
                );
            }

            // Update only the selected finding.
            setReview((previousReview) => ({
                ...previousReview,
                findings: previousReview.findings.map((finding) =>
                    finding.key === findingKey
                        ? updatedFinding
                        : finding
                ),
            }));

            setDecisionSuccess(
                `Finding ${decision.replace("_", " ")} successfully.`
            );

            setCommentDrafts((previous) => ({
                ...previous,
                [findingKey]: "",
            }));

        } catch (err) {
            console.error("Finding decision failed:", err);

            setDecisionError(
                err.response?.data?.message ||
                err.message ||
                "Unable to update finding decision."
            );
        } finally {
            setSavingFindingKey("");
        }
    };

    // --------------------------------------------------
    // LOADING STATE
    // --------------------------------------------------

    if (loading) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center">
                <RefreshCw
                    size={32}
                    className="animate-spin text-amber-500"
                />

                <p className="mt-4 text-sm text-slate-600">
                    Loading review details...
                </p>
            </div>
        );
    }

    // --------------------------------------------------
    // ERROR STATE
    // --------------------------------------------------

    if (error && !review) {
        return (
            <div className="mx-auto max-w-5xl py-10">
                <Link
                    to="/documents"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-950"
                >
                    <ArrowLeft size={17} />
                    Back to Documents
                </Link>

                <div className="rounded-xl border border-red-200 bg-red-50 p-6">
                    <p className="font-semibold text-red-800">
                        Unable to load review
                    </p>

                    <p className="mt-2 text-sm text-red-700">
                        {error}
                    </p>

                    <button
                        onClick={loadReview}
                        className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!review) return null;

    // --------------------------------------------------
    // REVIEW DATA
    // --------------------------------------------------

    const summary = review.summary || {};

    const findings = Array.isArray(review.findings)
        ? review.findings
        : [];

    const decisionCounts = findings.reduce(
        (counts, finding) => {
            const decision = finding.reviewDecision || "pending";

            if (Object.hasOwn(counts, decision)) {
                counts[decision] += 1;
            }

            return counts;
        },
        {
            pending: 0,
            approved: 0,
            rejected: 0,
            needs_changes: 0,
        }
    );

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    return (
        <div className="mx-auto max-w-7xl space-y-6">

            {/* HEADER */}

            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <Link
                        to="/documents"
                        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
                    >
                        <ArrowLeft size={17} />
                        Back to Documents
                    </Link>

                    <h1 className="text-2xl font-bold text-slate-950">
                        Review Details
                    </h1>

                    <p className="mt-2 text-sm text-slate-600">
                        Inspect the AI compliance analysis and human review decisions.
                    </p>
                </div>

                <button
                    onClick={loadReview}
                    disabled={loading}
                    className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw
                        size={16}
                        className={loading ? "animate-spin" : ""}
                    />
                    Refresh
                </button>
            </div>

            {/* DOWNLOADS */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="font-semibold text-slate-950">
                            {review.originalName || "Untitled document"}
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Reviewed on {formatDate(review.createdAt)}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: "reviewed_pdf", label: "Reviewed PDF" },
                            { key: "json", label: "JSON Report" },
                            { key: "markdown", label: "Markdown" },
                        ].map((item) => (
                            <button
                                key={item.key}
                                onClick={() => handleDownload(item.key)}
                                disabled={Boolean(downloading)}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <Download size={15} />

                                {downloading === item.key
                                    ? "Downloading..."
                                    : item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {error && (
                    <p className="mt-3 text-sm text-red-700">
                        {error}
                    </p>
                )}
            </section>

            {/* AI SUMMARY */}

            <section>
                <h2 className="mb-4 text-lg font-semibold text-slate-950">
                    Compliance Summary
                </h2>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

                    <SummaryCard
                        label="Overall Status"
                        value={summary.overall_status || "Not available"}
                        icon={<ShieldCheck size={21} />}
                    />

                    <SummaryCard
                        label="Total Findings"
                        value={summary.total_findings ?? findings.length}
                        icon={<FileText size={21} />}
                    />

                    <SummaryCard
                        label="Violations"
                        value={summary.violations ?? 0}
                        icon={<AlertTriangle size={21} />}
                    />

                    <SummaryCard
                        label="Needs Human Review"
                        value={summary.needs_human_review ?? 0}
                        icon={<Clock size={21} />}
                    />

                </div>
            </section>

            {/* HUMAN REVIEW SUMMARY */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5">
                    <h2 className="font-semibold text-slate-950">
                        Human Review Progress
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                        Current decisions across all findings.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                    <DecisionCount
                        label="Pending"
                        value={decisionCounts.pending}
                        color="text-slate-800"
                        background="bg-slate-100"
                    />

                    <DecisionCount
                        label="Approved"
                        value={decisionCounts.approved}
                        color="text-emerald-800"
                        background="bg-emerald-100"
                    />

                    <DecisionCount
                        label="Rejected"
                        value={decisionCounts.rejected}
                        color="text-red-800"
                        background="bg-red-100"
                    />

                    <DecisionCount
                        label="Needs Changes"
                        value={decisionCounts.needs_changes}
                        color="text-amber-800"
                        background="bg-amber-100"
                    />

                </div>
            </section>

            {/* DOCUMENT INFORMATION */}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-950">
                    Document Information
                </h2>

                <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <InfoItem
                        label="Policy"
                        value={
                            review.policy?.title ||
                            review.policyName ||
                            "Unknown policy"
                        }
                    />

                    <InfoItem
                        label="Policy Version"
                        value={review.policyVersion || "—"}
                    />

                    <InfoItem
                        label="Pages"
                        value={review.pages ?? "—"}
                    />

                    <InfoItem
                        label="Review Status"
                        value={review.status || "—"}
                    />

                    <InfoItem
                        label="Reused Findings"
                        value={review.reused ?? 0}
                    />

                    <InfoItem
                        label="Newly Judged"
                        value={review.newlyJudged ?? 0}
                    />

                    <InfoItem
                        label="Not Checked"
                        value={review.notChecked ?? 0}
                    />

                    <InfoItem
                        label="Document Check Failed"
                        value={review.docCheckFailed ? "Yes" : "No"}
                    />
                </div>
            </section>

            {/* DECISION FEEDBACK */}

            {decisionError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {decisionError}
                </div>
            )}

            {decisionSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                    {decisionSuccess}
                </div>
            )}

            {/* FINDINGS */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                <div className="border-b border-slate-200 p-5">
                    <h2 className="font-semibold text-slate-950">
                        AI Findings
                    </h2>

                    <p className="mt-1 text-sm text-slate-600">
                        Review AI-identified statements and record your decisions.
                    </p>
                </div>

                {findings.length === 0 ? (
                    <div className="p-10 text-center">
                        <CheckCircle2
                            size={35}
                            className="mx-auto text-emerald-600"
                        />

                        <p className="mt-3 font-semibold text-slate-900">
                            No findings available
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            The backend did not return any individual findings for this review.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200">
                        {findings.map((finding, index) => (
                            <article
                                key={finding.key || index}
                                className="space-y-5 p-5"
                            >

                                {/* FINDING HEADER */}

                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-900">
                                            Finding #{index + 1}
                                        </span>

                                        {finding.severity && (
                                            <span
                                                className={`rounded-full px-3 py-1 text-xs font-semibold ${getSeverityStyle(
                                                    finding.severity
                                                )}`}
                                            >
                                                {finding.severity}
                                            </span>
                                        )}

                                        {finding.status && (
                                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                                                AI: {finding.status}
                                            </span>
                                        )}
                                    </div>

                                    <span className="text-xs text-slate-500">
                                        Page: {finding.page ?? "—"}
                                    </span>
                                </div>

                                {/* STATEMENT */}

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Statement
                                    </p>

                                    <p className="mt-2 text-sm leading-6 text-slate-800">
                                        {finding.text || "No statement provided."}
                                    </p>
                                </div>

                                {finding.phrase && (
                                    <InfoBlock
                                        label="Identified Phrase"
                                        value={finding.phrase}
                                    />
                                )}

                                {finding.why && (
                                    <InfoBlock
                                        label="Why this was flagged"
                                        value={finding.why}
                                    />
                                )}

                                {finding.reference && (
                                    <InfoBlock
                                        label="Policy Reference"
                                        value={finding.reference}
                                    />
                                )}

                                {finding.suggestedFix && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                                            Suggested Fix
                                        </p>

                                        <p className="mt-2 text-sm leading-6 text-emerald-950">
                                            {finding.suggestedFix}
                                        </p>
                                    </div>
                                )}

                                {/* HUMAN REVIEW */}

                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">

                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                                Human Review Decision
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                                AI assessment and human decision are stored separately.
                                            </p>
                                        </div>

                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getDecisionStyle(
                                                finding.reviewDecision
                                            )}`}
                                        >
                                            {(finding.reviewDecision || "pending").replace("_", " ")}
                                        </span>
                                    </div>

                                    {/* COMMENT INPUT */}

                                    <textarea
                                        value={commentDrafts[finding.key] || ""}
                                        onChange={(event) =>
                                            setCommentDrafts((previous) => ({
                                                ...previous,
                                                [finding.key]: event.target.value,
                                            }))
                                        }
                                        placeholder="Add a reviewer comment..."
                                        rows={3}
                                        maxLength={2000}
                                        className="mt-4 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
                                    />

                                    <p className="mt-1 text-right text-xs text-slate-400">
                                        {(commentDrafts[finding.key] || "").length}/2000
                                    </p>

                                    {/* DECISION BUTTONS */}

                                    <div className="mt-3 flex flex-wrap gap-2">

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleFindingDecision(
                                                    finding.key,
                                                    "approved"
                                                )
                                            }
                                            disabled={
                                                !finding.key ||
                                                Boolean(savingFindingKey)
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={16} />
                                            {savingFindingKey === finding.key
                                                ? "Saving..."
                                                : "Approve"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleFindingDecision(
                                                    finding.key,
                                                    "rejected"
                                                )
                                            }
                                            disabled={
                                                !finding.key ||
                                                Boolean(savingFindingKey)
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <XCircle size={16} />
                                            Reject
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleFindingDecision(
                                                    finding.key,
                                                    "needs_changes"
                                                )
                                            }
                                            disabled={
                                                !finding.key ||
                                                Boolean(savingFindingKey)
                                            }
                                            className="inline-flex items-center gap-2 rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <MessageSquare size={16} />
                                            Request Changes
                                        </button>

                                    </div>

                                    {/* CURRENT REVIEWER COMMENT */}

                                    {finding.reviewerComment && (
                                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                                            <p className="text-xs font-semibold text-slate-500">
                                                Latest Reviewer Comment
                                            </p>

                                            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                                                {finding.reviewerComment}
                                            </p>
                                        </div>
                                    )}

                                    {/* DECISION HISTORY */}

                                    {finding.decisionHistory?.length > 0 && (
                                        <div className="mt-4 border-t border-slate-200 pt-4">

                                            <div className="mb-3 flex items-center gap-2">
                                                <History
                                                    size={16}
                                                    className="text-slate-500"
                                                />

                                                <p className="text-sm font-semibold text-slate-800">
                                                    Decision History
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                {[...finding.decisionHistory]
                                                    .reverse()
                                                    .map((history) => (
                                                        <div
                                                            key={
                                                                history._id ||
                                                                `${history.decision}-${history.reviewedAt}`
                                                            }
                                                            className="border-l-2 border-slate-300 pl-3"
                                                        >
                                                            <p className="text-sm font-semibold capitalize text-slate-800">
                                                                {history.previousDecision} → {history.decision}
                                                            </p>

                                                            <p className="mt-1 text-xs text-slate-500">
                                                                {formatDate(history.reviewedAt)}
                                                            </p>

                                                            {history.comment && (
                                                                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                                                                    {history.comment}
                                                                </p>
                                                            )}

                                                            {history.reviewer?.name && (
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Reviewer: {history.reviewer.name}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

        </div>
    );
}

// --------------------------------------------------
// REUSABLE COMPONENTS
// --------------------------------------------------

function SummaryCard({ label, value, icon }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                    {label}
                </p>

                <span className="text-slate-500">
                    {icon}
                </span>
            </div>

            <p className="mt-4 break-words text-2xl font-bold capitalize text-slate-950">
                {String(value)}
            </p>
        </div>
    );
}

function DecisionCount({ label, value, color, background }) {
    return (
        <div className="rounded-xl border border-slate-200 p-4">
            <span
                className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${background} ${color}`}
            >
                {label}
            </span>

            <p className="mt-3 text-2xl font-bold text-slate-950">
                {value}
            </p>
        </div>
    );
}

function InfoItem({ label, value }) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                {String(value)}
            </p>
        </div>
    );
}

function InfoBlock({ label, value }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {label}
            </p>

            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                {value}
            </p>
        </div>
    );
}
