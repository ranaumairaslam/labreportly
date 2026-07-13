"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function StaffLogin() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const [branding, setBranding] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("lab_dashboard_branding");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.labName || parsed.logoUrl) {
            return {
              labName: parsed.labName,
              logoUrl: parsed.logoUrl,
              tagline: parsed.tagline || "",
              address: parsed.address || "",
              phone: parsed.phone || ""
            };
          }
        } catch (e) {}
      }
    }
    return {
      labName: "",
      logoUrl: "/",
      tagline: "",
      address: "",
      phone: ""
    };
  });

  useEffect(() => {
    async function fetchBranding() {
      try {
        const res = await fetch("/api/labs");
        if (res.ok) {
          const data = await res.json();
          const activeLab = data.labs?.find(l => l.status === "Active") || data.labs?.[0];
          if (activeLab) {
            const b = activeLab.branding || {};
            const nextBranding = {
              labId: activeLab.id,
              labName: b.labName || activeLab.name || "",
              logoUrl: b.logoUrl || "/",
              tagline: b.tagline || "",
              address: b.address || activeLab.address || "",
              phone: b.phone || activeLab.phone || "",
              primaryColor: b.primaryColor || "#004d26",
              accentColor: b.accentColor || "#FBBF24",
              dashboardMenuOrder: b.dashboardMenuOrder || ["Overview", "New Registration", "Revenue", "Reports"],
              staffMenuOrder: b.staffMenuOrder || ["Registration", "Report Generated"],
            };
            setBranding(nextBranding);
            window.localStorage.setItem("lab_dashboard_branding", JSON.stringify(nextBranding));
          }
        }
      } catch (err) {
        console.warn("Failed to fetch branding from server", err);
      }
    }
    fetchBranding();
  }, []);

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
        localStorage.setItem("lab_profile", JSON.stringify(labData.lab));
        localStorage.setItem("lab_dashboard_branding", JSON.stringify({
          labId: labData.lab.id,
          labName: labData.lab.branding?.labName || labData.lab.name,
          tagline: labData.lab.branding?.tagline || "",
          address: labData.lab.branding?.address || labData.lab.address || "",
          phone: labData.lab.branding?.phone || labData.lab.phone || "",
          logoUrl: labData.lab.branding?.logoUrl || "/",
          primaryColor: labData.lab.branding?.primaryColor || "#004d26",
          accentColor: labData.lab.branding?.accentColor || "#FBBF24",
          dashboardMenuOrder: labData.lab.branding?.dashboardMenuOrder || ["Overview", "New Registration", "Revenue", "Reports"],
          staffMenuOrder: labData.lab.branding?.staffMenuOrder || ["Registration", "Report Generated"],
        }));
        router.push("/dashboard");
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
          router.push("/staff-dashboard");
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
    <div className="relative min-h-screen flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-900">
      
      {/* BACKGROUND IMAGE WITH MODERN BLENDED OVERLAY */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://images.unsplash.com/photo-1579165466541-74e2b49699f4?auto=format&fit=crop&q=80&w=1920" 
          alt="Lab Background"
          fill
          className="object-cover opacity-30 mix-blend-luminosity scale-105 animate-[pulse_8s_infinite_alternate]"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#022312] via-[#043d20]/90 to-slate-900/95" />
      </div>

      {/* FLOATING LIGHT GLOW EFFECTS */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[440px] z-10">

        {/* LOGO & BRANDING HEADERS */}
        <div className="flex flex-col items-center mb-8 drop-shadow-xl">
          <div className="relative w-24 h-24 overflow-hidden rounded-3xl border-2 border-white/20 bg-white/90 shadow-2xl flex items-center justify-center p-2 transition-transform duration-300 hover:scale-105">
            <Image
              src={branding.logoUrl || "/"}
              alt={branding.labName || ""}
              fill
              className="object-contain p-2"
              unoptimized
            />
          </div>

          <h1 className="text-3xl font-black text-white mt-4 tracking-wide text-center uppercase drop-shadow">
            {branding.labName || "LAB PORTAL"}
          </h1>

          <p className="text-xs font-medium tracking-[0.4em] text-emerald-400/90 uppercase mt-1 text-center max-w-xs">
            {branding.tagline || "Secure Management Environment"}
          </p>
        </div>

        {/* PREMIUM GLASS CARD */}
        <div className="backdrop-blur-2xl bg-white/[0.07] border border-white/[0.15] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden group">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold text-white tracking-wide">
               Authorized Access Only
            </h2>
            <p className="text-xs text-slate-400 mt-1">Provide your environment credentials below</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">

            {/* EMAIL / PERSONNEL ID */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase block ml-1">
                Personnel Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <input
                  type="email"
                  placeholder="name@laboratory.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-950/40 border border-white/10 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300"
                  required
                />
              </div>
            </div>

            {/* ACCESS KEY / PASSWORD */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase block ml-1">
                Access Key
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3.5 rounded-2xl bg-slate-950/40 border border-white/10 text-white placeholder-slate-500 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300"
                  required
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  {showPassword ? (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-bold tracking-widest hover:brightness-110 active:scale-[0.98] transition-all duration-200 shadow-[0_10px_20px_-5px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:pointer-events-none uppercase text-xs mt-2"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying Identity...
                </span>
              ) : (
                "AUTHORIZE GATEWAY"
              )}
            </button>

            {/* ERROR NOTIFICATION */}
            {error && (
              <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-2xl animate-[shake_0.4s_ease-in-out] flex items-center gap-2">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                </svg>
                {error}
              </div>
            )}
          </form>

          {/* DYNAMIC SYSTEM FOOTER */}
          <div className="mt-8 text-center border-t border-white/10 pt-5">
            <p className="text-[10px] text-slate-400 leading-relaxed tracking-wider font-light">
              {branding.address || "Secure Cloud Terminal"}
              {branding.phone && (
                <>
                  <br />
                  <span className="text-slate-500">System Assistance:</span> {branding.phone}
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}