
import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle2,
  Archive,
  RefreshCw,
  AlertCircle,
  FilePlus2,
  Loader2,
  X,
} from "lucide-react";

import {
  getPolicies,
  uploadPolicy,
  activatePolicy,
  deletePolicy,
  deleteAllPolicies,
} from "../services/policyService";

// Reusable button interaction styles
const buttonInteraction =
  "cursor-pointer transition-all duration-150 hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:active:scale-100 disabled:opacity-50";

// FORMAT DATE
const formatDate = (date) => {
  if (!date) return "Unknown date";

  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// FORMAT FILE SIZE
const formatSize = (bytes = 0) => {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const PolicyLibrary = () => {
  const fileInputRef = useRef(null);
  const { user } = useSelector((state) => state.auth);
  const isAdmin = user?.role === "admin";

  const [policies, setPolicies] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [fieldErrors, setFieldErrors] = useState({
    title: "",
    description: "",
    file: "",
  });

  // FETCH POLICIES
  const loadPolicies = useCallback(async () => {
    try {
      setError("");

      const response = await getPolicies();

      setPolicies(response?.data?.policies || []);

    } catch (err) {
      console.error("Failed to fetch policies:", err);

      setPolicies([]);

      setError(
        err.response?.data?.message ||
        "Failed to load policies."
      );

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  // SELECT PDF
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    setError("");
    setSuccess("");

    if (
      selectedFile.type !== "application/pdf" &&
      !selectedFile.name.toLowerCase().endsWith(".pdf")
    ) {
      setError("Only PDF files are allowed.");
      e.target.value = "";
      setFile(null);
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      setError("PDF size cannot exceed 20 MB.");
      e.target.value = "";
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  // REMOVE SELECTED PDF
  const handleRemoveFile = () => {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // UPLOAD POLICY
  const handleUpload = async (e) => {
    e.preventDefault();

    const errors = {
      title: "",
      description: "",
      file: "",
    };

    if (!title.trim()) {
      errors.title = "This field is required.";
    }

    if (!description.trim()) {
      errors.description = "This field is required.";
    }

    if (!file) {
      errors.file = "Please select a PDF file.";
    }

    setFieldErrors(errors);

    if (Object.values(errors).some(Boolean)) {
      return;
    }

    const formData = new FormData();

    formData.append("title", title.trim());
    formData.append("description", description.trim());
    formData.append("policy", file);

    try {
      setUploading(true);
      setError("");
      setSuccess("");

      await uploadPolicy(formData);

      setTitle("");
      setDescription("");
      setFile(null);

      setFieldErrors({
        title: "",
        description: "",
        file: "",
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccess("Policy uploaded successfully.");
      await loadPolicies();
    } catch (err) {
      setError(
        err.response?.data?.message || "Policy upload failed."
      );
    } finally {
      setUploading(false);
    }
  };

  // ACTIVATE POLICY
  const handleActivate = async (policyId) => {
    try {
      setActionId(policyId);
      setError("");
      setSuccess("");

      await activatePolicy(policyId);

      setSuccess("Policy activated successfully.");

      await loadPolicies();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Could not activate policy."
      );
    } finally {
      setActionId(null);
    }
  };

  // DELETE SINGLE POLICY
  const handleDelete = async (policy) => {
    const confirmed = window.confirm(
      `Delete "${policy.title}" permanently?`
    );

    if (!confirmed) return;

    try {
      setActionId(policy._id);
      setError("");
      setSuccess("");

      await deletePolicy(policy._id);

      setSuccess("Policy deleted successfully.");

      await loadPolicies();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Could not delete policy."
      );
    } finally {
      setActionId(null);
    }
  };

  // DELETE ALL POLICIES
  const handleDeleteAll = async () => {
    if (policies.length === 0) return;

    const confirmed = window.confirm(
      `Permanently delete all ${policies.length} policies and their PDF files? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingAll(true);
      setError("");
      setSuccess("");

      const response = await deleteAllPolicies();

      setSuccess(
        response.message ||
        "All policies deleted successfully."
      );

      await loadPolicies();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Could not delete all policies."
      );
    } finally {
      setDeletingAll(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">

      {/* PAGE HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Policy Library
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage the company policies used for AI compliance reviews.
          </p>
        </div>

        <button
          onClick={loadPolicies}
          disabled={loading}
          className={`${buttonInteraction} inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50`}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* NOTIFICATIONS */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />

          <span className="flex-1">{error}</span>

          <button
            onClick={() => setError("")}
            aria-label="Dismiss error"
            className={`${buttonInteraction} rounded p-1 hover:bg-red-100`}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />

          <span className="flex-1">{success}</span>

          <button
            onClick={() => setSuccess("")}
            aria-label="Dismiss success message"
            className={`${buttonInteraction} rounded p-1 hover:bg-emerald-100`}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* UPLOAD FORM */}
      {isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">

          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-2.5">
              <FilePlus2
                size={21}
                className="text-amber-700"
              />
            </div>

            <div>
              <h2 className="font-semibold text-slate-900">
                Upload New Policy
              </h2>

              <p className="text-sm text-slate-500">
                Add a company compliance policy.
              </p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">

            {/* TITLE */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Policy title *
              </label>

              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    title: "",
                  }));
                }}
                placeholder="e.g. Brand Guidelines 2026"
                maxLength={150}
                className={`w-full rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${fieldErrors.title
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
                  }`}
              />

              {fieldErrors.title && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* DESCRIPTION */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description *
              </label>

              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setFieldErrors((prev) => ({
                    ...prev,
                    description: "",
                  }));
                }}
                placeholder="Brief description of this policy"
                rows={3}
                maxLength={1000}
                className={`w-full resize-none rounded-lg border px-3 py-2.5 outline-none transition focus:ring-2 ${fieldErrors.description
                  ? "border-red-400 focus:border-red-400 focus:ring-red-100"
                  : "border-slate-200 focus:border-amber-400 focus:ring-amber-100"
                  }`}
              />

              {fieldErrors.description && (
                <p className="mt-1 text-xs font-medium text-red-500">
                  {fieldErrors.description}
                </p>
              )}
            </div>

            {/* PDF UPLOAD */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Policy PDF *
              </label>

              <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-6 transition-colors hover:border-amber-500 hover:bg-amber-100/70">

                <div className="flex flex-col items-center justify-center text-center">

                  <div className="mb-3 rounded-xl bg-amber-200 p-3">
                    <FilePlus2
                      size={30}
                      className="text-amber-800"
                    />
                  </div>

                  <p className="font-semibold text-slate-800">
                    Choose your policy PDF
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    PDF format only · Maximum file size 20 MB
                  </p>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={`${buttonInteraction} mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F5B800] px-5 py-2.5 text-sm font-bold text-slate-900 shadow-sm hover:bg-[#E5AA00] hover:shadow-md`}
                  >
                    <Upload size={17} />
                    Choose PDF File
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* SELECTED FILE PREVIEW */}
                {file && (
                  <div className="mt-5 flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-3">

                    <div className="rounded-lg bg-amber-100 p-2">
                      <FileText
                        size={22}
                        className="text-amber-700"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {file.name}
                      </p>

                      <p className="text-xs text-slate-500">
                        {formatSize(file.size)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      title="Remove selected file"
                      className={`${buttonInteraction} rounded-lg p-2 text-red-500 hover:bg-red-50`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* UPLOAD BUTTON */}
            <button
              type="submit"
              disabled={uploading}
              className={`${buttonInteraction} inline-flex items-center justify-center gap-2 rounded-lg bg-[#F5B800] px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-[#E5AA00]`}
            >
              {uploading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Upload Policy
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {/* POLICY LIST */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 md:p-6">

        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold text-slate-900">
              Uploaded Policies
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {policies.length} policies available
            </p>
          </div>

          {isAdmin && (
            <button
              onClick={handleDeleteAll}
              disabled={
                deletingAll ||
                policies.length === 0 ||
                !!actionId
              }
              className={`${buttonInteraction} inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50`}
            >
              {deletingAll ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}

              {deletingAll ? "Deleting..." : "Delete All"}
            </button>
          )}
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 size={20} className="animate-spin" />
            Loading policies...
          </div>
        ) : policies.length === 0 ? (

          /* EMPTY STATE */
          <div className="rounded-lg border border-dashed border-slate-200 py-12 text-center">
            <FileText
              size={36}
              className="mx-auto mb-3 text-slate-400"
            />

            <p className="font-medium text-slate-700">
              No policies uploaded yet
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Upload a company policy PDF to get started.
            </p>
          </div>

        ) : (

          /* POLICY CARDS */
          <div className="space-y-3">
            {policies.map((policy) => (
              <div
                key={policy._id}
                className={`flex flex-col justify-between gap-4 rounded-xl border p-4 transition-colors sm:flex-row sm:items-center ${policy.status === "active"
                  ? "border-emerald-200 bg-emerald-50/30"
                  : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
              >

                {/* POLICY DETAILS */}
                <div className="flex min-w-0 items-start gap-3">

                  <div
                    className={`rounded-lg p-3 ${policy.status === "active"
                      ? "bg-emerald-100"
                      : "bg-amber-50"
                      }`}
                  >
                    <FileText
                      size={23}
                      className={
                        policy.status === "active"
                          ? "text-emerald-700"
                          : "text-amber-600"
                      }
                    />
                  </div>

                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900">
                      {policy.title}
                    </h3>

                    <p className="mt-1 break-words text-sm text-slate-500">
                      {policy.originalName}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Uploaded {formatDate(policy.createdAt)}
                      {" · "}
                      {formatSize(policy.fileSize)}
                    </p>

                    {/* SINGLE STATUS INDICATOR */}
                    <div className="mt-3">
                      {policy.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 size={13} />
                          Currently Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          <Archive size={13} />
                          Archived
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ACTION BUTTONS */}
                {isAdmin && (
                  <div className="flex shrink-0 items-center gap-2">

                    {policy.status !== "active" && (
                      <button
                        onClick={() => handleActivate(policy._id)}
                        disabled={
                          actionId === policy._id ||
                          !!actionId ||
                          deletingAll
                        }
                        className={`${buttonInteraction} inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100`}
                      >
                        {actionId === policy._id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}

                        Activate
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(policy)}
                        disabled={!!actionId || deletingAll}
                        title="Delete policy"
                        className={`${buttonInteraction} rounded-lg p-2 text-red-500 hover:bg-red-50`}
                      >
                        <Trash2 size={18} />
                      </button>
                    )}

                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default PolicyLibrary;
