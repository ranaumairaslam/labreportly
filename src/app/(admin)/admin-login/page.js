"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function SuperAdminLogin() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/super-admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      localStorage.setItem("super_admin_token", data.token);
      router.push("/admin-dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#eefcff] via-[#d9f8fc] to-[#c5eef5] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white/95 backdrop-blur-xl border border-white shadow-[0_20px_60px_rgba(18,184,199,0.18)] p-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[#12B8C7] to-[#0A7D89] p-1 shadow-[0_12px_35px_rgba(18,184,199,0.35)]">
            <div className="relative w-full h-full rounded-full bg-white overflow-hidden">
              <Image
                src="/super/softcenteric-logo.webp"
                alt="Softcenteric Logo"
                fill
                priority
                className="object-contain p-2"
              />
            </div>
          </div>

          <h1 className="mt-6 text-3xl font-extrabold text-slate-800">
            Super Admin Panel
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Welcome back! Please sign in to continue.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Email */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Email Address
            </label>

            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@company.com"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-300 focus:border-[#12B8C7] focus:ring-4 focus:ring-[#12B8C7]/20"
            />
          </div>

          {/* Password */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 placeholder:text-slate-400 outline-none transition-all duration-300 focus:border-[#12B8C7] focus:ring-4 focus:ring-[#12B8C7]/20"
            />
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#12B8C7] to-[#0A7D89] py-3.5 text-white font-bold text-lg shadow-lg shadow-cyan-300/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-8 flex items-center">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="px-3 text-xs text-slate-400 uppercase">
            Secure Access
          </span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-slate-500">
            Softcenter Control System
          </p>

          <p className="mt-2 text-xs text-slate-400">
            © {new Date().getFullYear()} Softcenteric. All Rights Reserved.
          </p>
        </div>

      </div>
    </div>
  );
}