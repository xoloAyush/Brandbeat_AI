
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  FileText,
  Search,
  Filter,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Plus,
  CalendarDays,
  FileCheck2,
  RefreshCw,
} from "lucide-react";

import { Link } from "react-router-dom";
import { getReviews } from "../services/reviewService";

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
// EXTRACT REVIEWS FROM API RESPONSE
// --------------------------------------------------

const extractReviews = (response) => {
  return response?.data?.reviews || [];
};

// --------------------------------------------------
// FORMAT DATE
// --------------------------------------------------

const formatDate = (dateValue) => {
  if (!dateValue) return { date: "—", time: "—" };

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return { date: "—", time: "—" };
  }

  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),

    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
};

// --------------------------------------------------
// FORMAT REVIEW DATA
// --------------------------------------------------

const formatReview = (review) => {
  const summary = review.summary || {};

  const violations = Number(summary.violations || 0);
  const unverified = Number(summary.unverified || 0);
  const needsHumanReview = Number(
    summary.needs_human_review || 0
  );
  const notChecked = Number(summary.not_checked || 0);

  let status = "Processing";

  if (review.status === "failed") {
    status = "Review Failed";
  } else if (review.status !== "completed") {
    status = "Processing";
  } else {
    const overallStatus = String(
      summary.overall_status || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, " ");

    if (
      overallStatus.includes("non compliant") ||
      violations > 0
    ) {
      status = "Violations Found";
    } else if (
      overallStatus === "compliant" ||
      overallStatus === "fully compliant"
    ) {
      status = "Compliant";
    } else {
      // Unknown or incomplete results should be reviewed.
      status = "Needs Review";
    }

    if (
      unverified > 0 ||
      needsHumanReview > 0 ||
      notChecked > 0
    ) {
      status = "Needs Review";
    }
  }

  const { date, time } = formatDate(review.createdAt);

  return {
    id: review._id,
    name: review.originalName || review.fileName || "Untitled document",
    type: "Compliance Review",
    date,
    time,
    status,
    violations,
    pages: Number(review.pages || 0),
    policy: review.policy?.title || review.policyName || "Unknown policy",
  };
};

// --------------------------------------------------
// DOCUMENTS COMPONENT
// --------------------------------------------------

export default function Documents() {
  const [documents, setDocuments] = useState([]);

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState("All");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  // --------------------------------------------------
  // FETCH REVIEWS FROM EXPRESS BACKEND
  // --------------------------------------------------

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await getReviews();

      const reviews = extractReviews(response);

      const formattedDocuments = reviews.map(formatReview);

      setDocuments(formattedDocuments);
    } catch (err) {
      console.error("Failed to fetch documents:", err);

      setError(
        err.response?.data?.message ||
        "Unable to load documents. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // --------------------------------------------------
  // LOAD DOCUMENTS ON COMPONENT MOUNT
  // --------------------------------------------------

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // --------------------------------------------------
  // SUMMARY COUNTS
  // --------------------------------------------------

  const compliantCount = documents.filter(
    (doc) => doc.status === "Compliant"
  ).length;

  const pendingCount = documents.filter(
    (doc) =>
      doc.status === "Needs Review" ||
      doc.status === "Processing"
  ).length;

  const failedCount = documents.filter(
    (doc) =>
      doc.status === "Violations Found" ||
      doc.status === "Review Failed"
  ).length;

  // --------------------------------------------------
  // SEARCH AND FILTER
  // --------------------------------------------------

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const searchTerm = search.toLowerCase();

      const matchesSearch =
        doc.name.toLowerCase().includes(searchTerm) ||
        doc.type.toLowerCase().includes(searchTerm) ||
        doc.policy.toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusFilter === "All" ||
        doc.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [documents, search, statusFilter]);

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (

    <div className="mx-auto max-w-7xl">

      {/* PAGE HEADER */}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Documents
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Manage uploaded documents and track their compliance reviews.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <button
            onClick={loadDocuments}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />

            Refresh
          </button>

          <Link
            to="/new-review"
            className="flex items-center gap-2 rounded-xl bg-[#F5B800] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#E5AA00]"
          >
            <Plus size={18} />
            New Review
          </Link>

        </div>
      </div>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            {error}
          </p>

          <button
            onClick={loadDocuments}
            className="text-sm font-semibold text-red-800 underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">

        {/* TOTAL DOCUMENTS */}

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Total Documents
            </p>

            <FileText size={21} className="text-slate-500" />
          </div>

          <h2 className="mt-4 text-3xl font-bold text-slate-950">
            {loading ? "—" : documents.length}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Documents in your workspace
          </p>
        </div>

        {/* COMPLIANT */}

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Compliant
            </p>

            <ShieldCheck size={21} className="text-emerald-600" />
          </div>

          <h2 className="mt-4 text-3xl font-bold text-slate-950">
            {loading ? "—" : compliantCount}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Passed compliance checks
          </p>
        </div>

        {/* NEEDS REVIEW */}

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Needs Review
            </p>

            <Clock size={21} className="text-amber-600" />
          </div>

          <h2 className="mt-4 text-3xl font-bold text-slate-950">
            {loading ? "—" : pendingCount}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Require further attention
          </p>
        </div>

        {/* FAILED */}

        <div className="rounded-2xl border border-[#D8E0EA] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-600">
              Failed
            </p>

            <AlertTriangle size={21} className="text-red-600" />
          </div>

          <h2 className="mt-4 text-3xl font-bold text-slate-950">
            {loading ? "—" : failedCount}
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Violations or failed reviews
          </p>
        </div>

      </div>

      {/* DOCUMENTS TABLE */}

      <section className="overflow-hidden rounded-2xl border border-[#D8E0EA] bg-white shadow-sm">

        {/* TABLE HEADER */}

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">

          <div>
            <h2 className="font-semibold text-slate-950">
              All Documents
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Review your document compliance history.
            </p>
          </div>

          <div className="flex w-full flex-wrap gap-3 sm:w-auto">

            {/* SEARCH */}

            <div className="relative min-w-0 flex-1 sm:w-64">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search documents..."
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#D99E00] focus:ring-2 focus:ring-amber-100"
              />
            </div>

            {/* STATUS FILTER */}

            <div className="relative">
              <Filter
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-slate-700 outline-none transition focus:border-[#D99E00] focus:ring-2 focus:ring-amber-100"
              >
                <option value="All">All Status</option>
                <option value="Compliant">Compliant</option>
                <option value="Needs Review">Needs Review</option>
                <option value="Processing">Processing</option>
                <option value="Violations Found">
                  Violations Found
                </option>
                <option value="Review Failed">Review Failed</option>
              </select>
            </div>

          </div>
        </div>

        {/* RESPONSIVE TABLE */}

        <div className="overflow-x-auto">

          <table className="w-full min-w-[850px] text-left">

            <thead className="bg-slate-50">
              <tr className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                <th className="px-6 py-4">Document</th>
                <th className="px-6 py-4">Uploaded</th>
                <th className="px-6 py-4">Policy</th>
                <th className="px-6 py-4">Violations</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Pages</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">

              {/* LOADING */}

              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-16 text-center"
                  >
                    <RefreshCw
                      size={28}
                      className="mx-auto animate-spin text-amber-500"
                    />

                    <p className="mt-3 text-sm text-slate-600">
                      Loading your documents...
                    </p>
                  </td>
                </tr>

              ) : filteredDocuments.length > 0 ? (

                /* DOCUMENT ROWS */

                filteredDocuments.map((doc) => (

                  <tr
                    key={doc.id}
                    className="transition hover:bg-slate-50"
                  >

                    {/* DOCUMENT */}

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">

                        <div className="rounded-lg bg-amber-50 p-2.5">
                          <FileText
                            size={21}
                            className="text-slate-800"
                          />
                        </div>

                        <div>
                          <Link
                            to={`/reviews/${doc.id}`}
                            className="text-sm font-semibold text-slate-900 hover:text-amber-700"
                          >
                            {doc.name}
                          </Link>

                          <p className="mt-1 text-xs text-slate-500">
                            {doc.type}
                          </p>
                        </div>

                      </div>
                    </td>

                    {/* UPLOADED */}

                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <CalendarDays
                          size={15}
                          className="text-slate-500"
                        />

                        {doc.date}
                      </div>

                      <p className="mt-1 pl-6 text-xs text-slate-500">
                        {doc.time}
                      </p>
                    </td>

                    {/* POLICY */}

                    <td className="max-w-52 px-6 py-5">
                      <p className="text-sm text-slate-700">
                        {doc.policy}
                      </p>
                    </td>

                    {/* VIOLATIONS */}

                    <td className="px-6 py-5">
                      <span
                        className={`text-sm font-semibold ${doc.violations > 0
                          ? "text-red-700"
                          : "text-emerald-700"
                          }`}
                      >
                        {doc.violations}
                      </span>
                    </td>

                    {/* STATUS */}

                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[doc.status] ||
                          "bg-slate-100 text-slate-700"
                          }`}
                      >
                        {doc.status}
                      </span>
                    </td>

                    {/* PAGES */}

                    <td className="px-6 py-5">
                      <span className="text-sm font-medium text-slate-700">
                        {doc.pages}
                      </span>
                    </td>

                  </tr>

                ))

              ) : (

                /* EMPTY STATE */

                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-16 text-center"
                  >
                    <FileText
                      size={35}
                      className="mx-auto text-slate-400"
                    />

                    <h3 className="mt-3 font-semibold text-slate-900">
                      {search || statusFilter !== "All"
                        ? "No documents found"
                        : "No reviews yet"}
                    </h3>

                    <p className="mt-1 text-sm text-slate-600">
                      {search || statusFilter !== "All"
                        ? "Try changing your search or status filter."
                        : "Upload your first document to start a compliance review."}
                    </p>

                    {!search && statusFilter === "All" && (
                      <Link
                        to="/new-review"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#F5B800] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#E5AA00]"
                      >
                        <Plus size={17} />
                        Create your first review
                      </Link>
                    )}

                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* TABLE FOOTER */}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">

          <p className="text-sm text-slate-600">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {loading ? "—" : filteredDocuments.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">
              {loading ? "—" : documents.length}
            </span>{" "}
            documents
          </p>

          <Link
            to="/new-review"
            className="flex items-center gap-1 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
          >
            Upload another document
            <ArrowUpRight size={16} />
          </Link>

        </div>

      </section>

      {/* INFORMATION */}

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">

        <FileCheck2
          size={20}
          className="mt-0.5 shrink-0 text-slate-800"
        />

        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Compliance review history
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-700">
            Documents marked as Needs Review require further human
            verification. A missing evidence source should not
            automatically be treated as a confirmed policy violation.
          </p>
        </div>

      </div>

    </div>

  );
}
