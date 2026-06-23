"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function StaffLogin() {
  const router = useRouter();

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
      });

      const labData = await labRes.json();

      if (labRes.ok) {
        router.push("/dashboard");
        return;
      }

      const staffRes = await fetch("/api/staff/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const staffData = await staffRes.json();

      if (staffRes.ok) {
        router.push("/staff-dashboard");
        return;
      }

      throw new Error(staffData.message || labData.message || "Invalid credentials");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#eafaf3] via-white to-[#f6fff9] p-6">

      <div className="w-full max-w-md">

        {/* LOGO SECTION */}
      <div className="flex flex-col items-center mb-6">
  <div className="relative w-43 h-43  justify-center">
    <Image
      src="/Al-jannat.png"
      alt="Al-Jannat"
    fill
      
      className="object-contain p-2"
    />
  </div>

          <h1 className="text-3xl font-extrabold text-[#004d26] mt-3 tracking-wide">
            AL-JANNAT
          </h1>

          <p className="text-xs tracking-[0.35em] text-slate-500 uppercase mt-1">
            Clinical Laboratory
          </p>
        </div>

        {/* GLASS CARD */}
        <div className="backdrop-blur-xl bg-white/70 border border-white/40 shadow-2xl rounded-3xl p-8">

          <h2 className="text-center text-lg font-semibold text-slate-700 mb-6">
            Staff Login Portal
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* EMAIL */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase">
                Personnel ID / Email
              </label>

              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-[#004d26] focus:ring-2 focus:ring-green-200 outline-none transition"
                required
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="text-[11px] font-semibold text-slate-600 uppercase">
                Access Key
              </label>

              <div className="relative mt-1">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/80 border border-slate-200 focus:border-[#004d26] focus:ring-2 focus:ring-green-200 outline-none transition pr-12"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#004d26]"
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

            {/* BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#004d26] to-[#007a3d] text-yellow-300 font-bold tracking-widest hover:scale-[1.02] active:scale-95 transition shadow-lg"
            >
              {isLoading ? "Authenticating..." : "AUTHORIZE LOGIN"}
            </button>

            {/* ERROR */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
                {error}
              </div>
            )}
          </form>

          {/* FOOTER */}
          <div className="mt-6 text-center border-t pt-4">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              171-D Block, Near Faysal Bank, Thana Bazar, Arifwala
              <br />
              Cell: 0300-6943193
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
