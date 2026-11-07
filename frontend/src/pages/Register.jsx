
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { registerUser } from "../features/auth/authSlice";

export default function Register() {
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const { isLoading, error } = useSelector((state) => state.auth);

    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            await dispatch(registerUser(form)).unwrap();
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
                        Create your account
                    </h1>
                    <p className="mt-2 text-sm text-slate-500">
                        Join your Brandbeat AI workspace.
                    </p>
                </div>

                {error && (
                    <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                <div>
                    <label className="mb-2 block text-sm font-medium">Full name</label>
                    <input
                        name="name"
                        required
                        minLength={2}
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Your name"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-yellow-500"
                    />
                </div>

                <div>
                    <label className="mb-2 block text-sm font-medium">Email address</label>
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
                    <label className="mb-2 block text-sm font-medium">Password</label>
                    <input
                        name="password"
                        type="password"
                        required
                        minLength={8}
                        value={form.password}
                        onChange={handleChange}
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-yellow-500"
                    />
                </div>

                <button
                    disabled={isLoading}
                    className="w-full rounded-lg bg-[#F5B800] px-4 py-3 font-semibold text-slate-950 hover:bg-[#E5AA00] disabled:opacity-60"
                >
                    {isLoading ? "Creating account..." : "Create account"}
                </button>

                <p className="text-center text-sm text-slate-600">
                    Already registered?{" "}
                    <Link to="/login" className="font-semibold text-slate-900 underline">
                        Sign in
                    </Link>
                </p>
            </form>
        </div>
    );
}
