"use client";

import React, { useState } from "react";

/* ────────────────────────────────────────────────────────────
   Dashboard branding is loaded after a successful login.
   ──────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────── */

export default function StaffLogin() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const credentials = { email: email.trim(), password };

    try {
      const labRes = await fetch("/api/labs/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
        cache: "no-store",
      });
      const labData = await labRes.json();

      if (labRes.ok) {
        localStorage.setItem("lab_profile", JSON.stringify(labData.lab));
        localStorage.setItem("lab_dashboard_branding", JSON.stringify({
          labId: labData.lab.id,
          labName: labData.lab.branding?.labName || labData.lab.name || "",
          tagline: labData.lab.branding?.tagline || "",
          address: labData.lab.branding?.address || labData.lab.address || "",
          phone: labData.lab.branding?.phone || labData.lab.phone || "",
          logoUrl: labData.lab.branding?.logoUrl || "/",
          primaryColor: labData.lab.branding?.primaryColor || "#004d26",
          accentColor: labData.lab.branding?.accentColor || "#FBBF24",
          dashboardMenuOrder: labData.lab.branding?.dashboardMenuOrder || ["Overview", "New Registration", "Revenue", "Reports"],
          staffMenuOrder: labData.lab.branding?.staffMenuOrder || ["Registration", "Report Generated"],
        }));
        if (typeof window !== "undefined") {
          window.location.assign("/dashboard");
        }
        return;
      }

      if (labData.message === "Invalid email or password") {
        const staffRes = await fetch("/api/staff/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        const staffData = await staffRes.json();

        if (staffRes.ok) {
          localStorage.setItem("staff_profile", JSON.stringify({
            ...staffData.staff,
            role: staffData.staff?.role || "Staff",
            canCreateStaff: Boolean(staffData.staff?.canCreateStaff),
          }));
          if (staffData.staff?.labId) {
            localStorage.setItem("lab_profile", JSON.stringify({ id: staffData.staff.labId }));
          }
          if (typeof window !== "undefined") {
            window.location.assign("/staff-dashboard");
          }
          return;
        }

        throw new Error(staffData.message || "Invalid credentials");
      }

      throw new Error(labData.message || "Invalid credentials");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#eafaf3] via-white to-[#f6fff9] p-6">
      <div className="w-full max-w-md">

        {/* Logo + name section */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center">
            <img src="/super/softcenteric-logo.webp"></img>
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-800 tracking-tight">
            MedCore Diagnostics
          </h1>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">
            Staff &amp; Lab Portal
          </p>
        </div>

        <div className="relative z-10 backdrop-blur-xl bg-white/70 border border-white/40 shadow-2xl rounded-3xl p-8">
          <h2 className="text-center text-lg font-semibold text-slate-700 mb-6">
             Login Portal
          </h2>

          <form onSubmit={handleLogin} className="relative z-10 space-y-5 pointer-events-auto">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase">
                Personnel ID / Email
              </label>
              <input
                id="lab-login-email"
                name="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-[#004d26] focus:ring-2 focus:ring-green-200 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase">
                Access Key
              </label>
              <div className="relative mt-1">
                <input
                  id="lab-login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-[#004d26] focus:ring-2 focus:ring-green-200 outline-none transition pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[rgb(60,167,206)]"
                >
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 3l14 14" />
                      <path d="M10 5c7 0 10 7 10 7a13 13 0 0 1-3 4" />
                      <path d="M6 6a10 10 0 0 0-4 6s3 7 10 7a9 9 0 0 0 5-2" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#05344d] to-[#0994aa] text-yellow-300 font-bold tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
            >
              {isLoading ? "Authenticating..." : "AUTHORIZE LOGIN"}
            </button>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
                {error}
              </div>
            )}
          </form>

        </div>
      </div>
    </div>
  );
}