
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../features/auth/authSlice";

export default function Login() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isLoading, error } = useSelector((state) => state.auth);

    const [form, setForm] = useState({
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await dispatch(loginUser(form)).unwrap();
            navigate("/", { replace: true });
        } catch {
            // Error is stored in Redux.
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FA] px-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Sign in to your Brandbeat AI workspace.
                    </p>
                </div>

                {error && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Email address
                    </label>
                    <input
                        name="email"
                        type="email"
                        required
                        value={form.email}
                        onChange={handleChange}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-yellow-500"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">
                        Password
                    </label>
                    <input
                        name="password"
                        type="password"
                        required
                        value={form.password}
                        onChange={handleChange}
                        placeholder="Enter your password"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-yellow-500"
                    />
                </div>

                <button
                    disabled={isLoading}
                    className="w-full rounded-lg bg-[#F5B800] px-4 py-3 font-semibold text-slate-950 hover:bg-[#E5AA00] disabled:opacity-60"
                >
                    {isLoading ? "Signing in..." : "Sign in"}
                </button>

                <p className="text-center text-sm text-slate-600">
                    Don't have an account?{" "}
                    <Link to="/register" className="font-semibold text-slate-900 underline">
                        Create account
                    </Link>
                </p>
            </form>
        </div>
    );
}
