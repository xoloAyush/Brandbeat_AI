
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FileCheck2,
  AlertTriangle,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Plus,
  RefreshCw,
} from "lucide-react";

import { Link } from "react-router-dom";
import { useSelector } from "react-redux";

import { getReviews } from "../services/reviewService";

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getReviewStatus = (review) => {
  if (review.status === "failed") return "Review Failed";

  if (review.status !== "completed") return "Processing";

  const summary = review.summary || {};

  const violations = Number(summary.violations || 0);
  const unverified = Number(summary.unverified || 0);
  const humanReview = Number(summary.needs_human_review || 0);
  const notChecked = Number(summary.not_checked || 0);

  const overallStatus = String(
    summary.overall_status || ""
  ).trim().toLowerCase().replace(/[_-]+/g, " ");

  if (
    overallStatus.includes("non compliant") ||
    violations > 0
  ) {
    return "Violations Found";
  }

  if (
    unverified > 0 ||
    humanReview > 0 ||
    notChecked > 0
  ) {
    return "Needs Review";
  }

  if (
    overallStatus === "compliant" ||
    overallStatus === "fully compliant"
  ) {
    return "Compliant";
  }

  return "Needs Review";
};

const formatDate = (dateValue) => {
  if (!dateValue) return "Date unavailable";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// --------------------------------------------------
// DASHBOARD
// --------------------------------------------------

export default function Dashboard() {
  const user = useSelector((state) => state.auth.user);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --------------------------------------------------
  // FETCH REVIEWS
  // --------------------------------------------------

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getReviews();

      setReviews(response?.data?.reviews || []);
    } catch (err) {
      console.error("Dashboard loading failed:", err);

      setError(
        err.response?.data?.message ||
        "Unable to load dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // --------------------------------------------------
  // CALCULATE STATISTICS
  // --------------------------------------------------

  const statistics = useMemo(() => {
    const formattedReviews = reviews.map((review) => ({
      ...review,
      displayStatus: getReviewStatus(review),
    }));

    const violations = reviews.reduce(
      (total, review) =>
        total + Number(review.summary?.violations || 0),
      0
    );

    return {
      total: reviews.length,

      violations,

      compliant: formattedReviews.filter(
        (review) => review.displayStatus === "Compliant"
      ).length,

      pending: formattedReviews.filter(
        (review) =>
          review.displayStatus === "Needs Review" ||
          review.displayStatus === "Processing"
      ).length,

      recent: formattedReviews.slice(0, 5),
    };
  }, [reviews]);

  // --------------------------------------------------
  // STATISTICS CARDS
  // --------------------------------------------------

  const stats = [
    {
      title: "Documents Reviewed",
      value: statistics.total,
      change: "Total reviews",
      icon: FileCheck2,
    },
    {
      title: "Policy Violations",
      value: statistics.violations,
      change: "Across all reviews",
      icon: AlertTriangle,
    },
    {
      title: "Compliant Documents",
      value: statistics.compliant,
      change: "Passed compliance checks",
      icon: ShieldCheck,
    },
    {
      title: "Pending Reviews",
      value: statistics.pending,
      change: "Require attention",
      icon: Clock,
    },
  ];

  // --------------------------------------------------
  // STATUS STYLES
  // --------------------------------------------------

  const statusStyles = {
    Compliant: "bg-emerald-100 text-emerald-800",
    "Needs Review": "bg-amber-100 text-amber-800",
    "Violations Found": "bg-red-100 text-red-800",
    Processing: "bg-blue-100 text-blue-800",
    "Review Failed": "bg-red-100 text-red-800",
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl">

      {/* WELCOME */}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Welcome, {user?.name || "User"}
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Here's what's happening with your brand compliance.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <Link
            to="/new-review"
            className="flex items-center gap-2 rounded-xl bg-[#F5B800] px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-[#E5AA00]"
          >
            <Plus size={18} />
            New Review
          </Link>
        </div>
      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* STATISTICS */}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.title}
              className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-600">
                  {stat.title}
                </p>

                <div className="rounded-lg bg-amber-50 p-2">
                  <Icon size={20} className="text-slate-700" />
                </div>
              </div>

              <h2 className="mt-4 text-3xl font-bold text-slate-950">
                {loading ? "—" : stat.value}
              </h2>

              <p className="mt-2 text-xs font-medium text-slate-500">
                {stat.change}
              </p>
            </div>
          );
        })}
      </div>

      {/* RECENT REVIEWS */}

      <section className="mt-8 overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">

        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              Recent Reviews
            </h2>

            <p className="mt-1 text-sm font-medium text-slate-600">
              Your latest compliance checks
            </p>
          </div>

          <Link
            to="/documents"
            className="flex items-center gap-1 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
          >
            View all
            <ArrowUpRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Loading recent reviews...
          </div>
        ) : statistics.recent.length > 0 ? (
          <div className="divide-y divide-slate-200">
            {statistics.recent.map((review) => (
              <Link
                key={review._id}
                to={`/reviews/${review._id}`}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {review.originalName || review.fileName}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(review.createdAt)}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[review.displayStatus]
                    }`}
                >
                  {review.displayStatus}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <FileCheck2
              size={35}
              className="mx-auto text-slate-400"
            />

            <p className="mt-3 font-semibold text-slate-900">
              No reviews yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Upload your first document to start a compliance review.
            </p>

            <Link
              to="/new-review"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F5B800] px-5 py-3 text-sm font-semibold text-slate-950"
            >
              <Plus size={17} />
              Create Review
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
