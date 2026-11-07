
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { getPolicies } from "../services/policyService";
import { createReview } from "../services/reviewService";
import {
  UploadCloud,
  FileText,
  X,
  ShieldCheck,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const MAX_FILE_SIZE = 20 * 1024 * 1024;



export default function NewReview() {
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [policies, setPolicies] = useState([]);
  const [selectedPolicy, setSelectedPolicy] = useState("");

  const [loadingPolicies, setLoadingPolicies] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [file, setFile] = useState(null);
  // const [selectedPolicy, setSelectedPolicy] = useState("brand-policy");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const formatFileSize = (bytes) => {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const validateFile = (selectedFile) => {
    setError("");
    setSubmitted(false);

    if (!selectedFile) return;

    const isPDF =
      selectedFile.type === "application/pdf" ||
      selectedFile.name.toLowerCase().endsWith(".pdf");

    if (!isPDF) {
      setError("Only PDF files are supported.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File size must not exceed 20 MB.");
      return;
    }

    if (selectedFile.size === 0) {
      setError("The selected file is empty.");
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files[0];
    validateFile(droppedFile);
  };

  const handleFileChange = (event) => {
    validateFile(event.target.files[0]);
    event.target.value = "";
  };

  const removeFile = () => {
    setFile(null);
    setError("");
    setSubmitted(false);
  };


  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!file) {
      setError("Please upload a PDF before continuing.");
      return;
    }

    if (!selectedPolicy) {
      setError("No active brand policy is available.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("policyId", selectedPolicy);

    try {
      setSubmitting(true);
      setError("");
      setSubmitted(false);

      const response = await createReview(formData);

      console.log("Review API response:", response);

      // Match your Express response structure.
      const reviewId =
        response?.data?.reviewId ||
        response?.data?.review?._id;

      if (!reviewId) {
        throw new Error(
          "Review completed, but review ID was not returned."
        );
      }

      setSubmitted(true);

      // Open the completed review directly.
      navigate(`/reviews/${reviewId}`, {
        replace: true,
      });

    } catch (err) {
      console.error("Review submission error:", err);

      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Failed to submit compliance review."
      );

    } finally {
      setSubmitting(false);
    }
  };


  useEffect(() => {
    const loadPolicies = async () => {
      try {
        setError("");

        const response = await getPolicies();

        // Supports both a direct response and an ApiResponse wrapper.
        const allPolicies =
          response?.data?.policies ??
          response?.policies ??
          [];

        const activePolicies = allPolicies.filter(
          (policy) => policy.status === "active"
        );

        setPolicies(activePolicies);

        if (activePolicies.length > 0) {
          setSelectedPolicy(activePolicies[0]._id);
        } else {
          setSelectedPolicy("");
        }

      } catch (err) {
        console.error("Policy loading error:", err);

        setError(
          err.response?.data?.message ||
          "Unable to load active policies."
        );
      } finally {
        setLoadingPolicies(false);
      }
    };

    loadPolicies();
  }, []);

  return (

    <div className="mx-auto max-w-5xl">

      {/* Page heading */}
      <div className="mb-7">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        <h1 className="text-2xl font-bold text-slate-950">
          New Compliance Review
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          Upload your marketing document and validate it against
          your approved brand policies.
        </p>
      </div>

      <form onSubmit={handleSubmit}>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">

          {/* Upload section */}
          <section className="rounded-2xl border border-[#D8E0EA] bg-white p-6 shadow-sm">

            <div className="mb-5">
              <h2 className="text-base font-semibold text-slate-950">
                Upload Document
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                Select the marketing document you want to review.
              </p>
            </div>

            {!file ? (
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`flex min-h-72 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${isDragging
                  ? "border-[#D99E00] bg-amber-50"
                  : "border-slate-300 bg-slate-50 hover:border-[#D99E00] hover:bg-amber-50/40"
                  }`}
              >
                <div className="mb-4 rounded-2xl bg-amber-100 p-4">
                  <UploadCloud
                    size={32}
                    className="text-slate-900"
                  />
                </div>

                <h3 className="font-semibold text-slate-900">
                  Drag and drop your PDF here
                </h3>

                <p className="mt-2 text-sm text-slate-600">
                  or browse files from your computer
                </p>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-5 rounded-lg bg-[#F5B800] px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-[#E5AA00]"
                >
                  Browse Files
                </button>

                <p className="mt-5 text-xs text-slate-500">
                  PDF only · Maximum file size: 20 MB
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">

                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-red-100 p-3">
                      <FileText
                        size={26}
                        className="text-red-600"
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="break-all text-sm font-semibold text-slate-900">
                        {file.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={removeFile}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-100 hover:text-red-600"
                    aria-label="Remove uploaded file"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={17} />
                  PDF selected successfully
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 text-sm font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-950"
                >
                  Replace document
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={17} />
                {error}
              </div>
            )}

            {submitted && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 size={18} />
                  Frontend validation completed
                </div>
                <p className="mt-1">
                  Your document is ready. Backend integration is the next step;
                  no document has been uploaded to a server yet.
                </p>
              </div>
            )}
          </section>

          {/* Configuration section */}
          <section className="h-fit rounded-2xl border border-[#D8E0EA] bg-white p-6 shadow-sm">

            <h2 className="text-base font-semibold text-slate-950">
              Review Configuration
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Configure how your document should be reviewed.
            </p>

            {/* Policy selection */}
            <div className="mt-7">
              <label
                htmlFor="policy"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Select Brand Policy
              </label>

              <div className="relative">
                <select
                  id="policy"
                  value={selectedPolicy}
                  onChange={(event) => {
                    setSelectedPolicy(event.target.value);
                    setSubmitted(false);
                  }}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-800 outline-none transition focus:border-[#D99E00] focus:ring-2 focus:ring-amber-100"
                >
                  {loadingPolicies ? (
                    <option value="">Loading policies...</option>
                  ) : policies.length === 0 ? (
                    <option value="">No active policy available</option>
                  ) : (
                    policies.map((policy) => (
                      <option key={policy._id} value={policy._id}>
                        {policy.title}
                      </option>
                    ))
                  )}
                </select>

                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Select the approved policy used as the review reference.
              </p>
            </div>

            {/* Policy information */}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">

              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={20}
                  className="text-slate-800"
                />

                <h3 className="text-sm font-semibold text-slate-900">
                  Policy-based verification
                </h3>
              </div>

              <p className="mt-2 text-sm leading-6 text-slate-700">
                Your document will be checked against the selected
                policy for brand consistency, unsupported claims,
                terminology, and content requirements.
              </p>

              <p className="mt-3 text-xs font-medium text-slate-600">
                {policies.find(
                  (policy) => policy._id === selectedPolicy
                )?.policyVersion || "Active policy"}
              </p>
            </div>

            {/* Review information */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Document format
                </span>
                <span className="font-semibold text-slate-800">
                  PDF
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Maximum size
                </span>
                <span className="font-semibold text-slate-800">
                  20 MB
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">
                  Review mode
                </span>
                <span className="font-semibold text-slate-800">
                  AI-assisted
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                !file ||
                !selectedPolicy ||
                loadingPolicies ||
                submitting
              }
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F5B800] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-[#E5AA00] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              {submitting ? "Processing Review..." : "Start Compliance Review"}

              {!submitting && <ArrowRight size={18} />}
            </button>

            <p className="mt-3 text-center text-xs text-slate-500">
              You can inspect findings before making changes.
            </p>
          </section>
        </div>
      </form>
    </div>

  );
}
