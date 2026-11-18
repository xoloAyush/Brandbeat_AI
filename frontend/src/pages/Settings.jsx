
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";

function Settings() {
  const navigate = useNavigate();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState("");

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setError("");

      // Call Express logout endpoint
      await api.post("/auth/logout");

      // Reload the app so authentication state is reinitialized
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout failed:", err);

      setError(
        err.response?.data?.message ||
        "Unable to log out. Please try again."
      );

      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 md:p-10">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-indigo-600 mb-2">
            Workspace
          </p>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>

          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Manage your account and workspace preferences.
          </p>
        </div>

        {/* Account Settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
                />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Account
              </h2>
              <p className="text-sm text-gray-500">
                Manage your account session.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-medium text-gray-800 dark:text-gray-200">
                  Sign out
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Sign out of your Brandbeat AI account on this device.
                </p>
              </div>

              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 font-medium text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingOut ? (
                  <>
                    <span className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    Signing out...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5m5 5H3"
                      />
                    </svg>
                    Logout
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Workspace Settings */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 7h16M4 12h16M4 17h16"
                />
              </svg>
            </div>

            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                Workspace
              </h2>
              <p className="text-sm text-gray-500">
                Brandbeat AI Compliance System
              </p>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-sm text-gray-500">
              Your workspace is configured for AI-powered document
              compliance reviews and policy management.
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-8">
          Brandbeat AI · Settings
        </p>

      </div>
    </div>
  );
}

export default Settings;
