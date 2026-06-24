"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Plus, 
  Search, 
  LogOut, 
  Loader2, 
  UserCheck, 
  UserX,
  X,
  Mail,
  Lock,
  Calendar
} from "lucide-react";
import { toast, Toaster } from "sonner";

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Dashboard state (fully frontend managed)
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // stores lab ID being updated
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    owner: "",
    email: "",
    password: ""
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    // Authenticate super-admin check
    const token = localStorage.getItem("super_admin_token");
    if (!token) {
      router.push("/admin-login");
      return;
    }

    async function loadLabs() {
      try {
        const token = localStorage.getItem("super_admin_token");
        if (!token) {
          router.push("/admin-login");
          return;
        }

        const res = await fetch("/api/admin/labs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Could not load laboratories");
        }

        setLabs(data.labs || []);
      } catch (error) {
        console.error(error);
        toast.error("Could not load laboratories. Check your credentials or MongoDB connection.");
      } finally {
        setLoading(false);
      }
    }

    loadLabs();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("super_admin_token");
    toast.success("Logged out successfully");
    router.push("/admin-login");
  };

  // Toggle lab status (Client-side only)
  const handleToggleStatus = async (labId, currentStatus) => {
    setActionLoading(labId);
    const newStatus = currentStatus === "Active" ? "Suspended" : "Active";
    const token = localStorage.getItem("super_admin_token");

    try {
      const res = await fetch("/api/admin/labs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: labId, status: newStatus }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("super_admin_token");
          router.push("/admin-login");
          return;
        }
        throw new Error(data.message || "Could not update laboratory");
      }

      setLabs(prev => prev.map(l => l.id === labId ? data.lab : l));
      toast.success(`Laboratory is now ${newStatus}`);
    } catch (error) {
      console.error(error);
      toast.error("Could not update laboratory. Check your credentials or MongoDB connection.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOnboardSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    setFormSubmitting(true);
    const token = localStorage.getItem("super_admin_token");

    try {
      const res = await fetch("/api/admin/labs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("super_admin_token");
          router.push("/admin-login");
          return;
        }
        throw new Error(data.message || "Could not onboard laboratory");
      }

      setLabs(prev => [data.lab, ...prev]);
      toast.success("Laboratory onboarded successfully!");
      setShowOnboardModal(false);
      setForm({ name: "", owner: "", email: "", password: "" });
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not onboard laboratory. Check your credentials or MongoDB connection.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Dynamically calculate stats based on frontend labs list
  const totalLabs = labs.length;
  const activeLabs = labs.filter(l => l.status === "Active").length;
  const suspendedLabs = labs.filter(l => l.status === "Suspended").length;
  
  // Calculate labs added in the last 30 days
  const newLabsThisMonth = labs.filter(l => {
    const labDate = new Date(l.date);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return labDate > thirtyDaysAgo;
  }).length;

  // Filter laboratories based on search query
  const filteredLabs = labs.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex font-sans antialiased selection:bg-cyan-500 selection:text-slate-900">
      <Toaster position="top-right" theme="dark" richColors />

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between p-6 shrink-0">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/10">
              SC
            </div>
            <div>
              <h1 className="font-extrabold text-white tracking-wide text-lg">Softcenteric</h1>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Super Admin</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold px-3 mb-2">Navigation</p>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-800/60 text-cyan-400 font-medium text-sm transition-all border-l-2 border-cyan-500">
              <Building2 className="w-4 h-4" />
              Laboratories
            </button>
            <button 
              onClick={() => toast.info("Subscriptions panel is currently read-only.")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/40 font-medium text-sm transition-all border-l-2 border-transparent"
            >
              <Users className="w-4 h-4" />
              Subscriptions
            </button>
          </nav>
        </div>

        {/* User profile / Logout */}
        <div className="pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-slate-300">
                SA
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-200">Admin Account</p>
                <p className="text-[10px] text-slate-500">System Controller</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-950/40 hover:bg-red-900/40 text-red-400 rounded-lg text-xs font-bold transition-all border border-red-900/30"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout System
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col overflow-y-auto max-h-screen">
        
        {/* TOP BAR */}
        <header className="px-8 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/30 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-white">Laboratories Directory</h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage and onboard clinical laboratories endpoints.</p>
          </div>
          
          <button 
            onClick={() => setShowOnboardModal(true)}
            className="bg-cyan-500 hover:bg-cyan-600 active:scale-95 text-slate-950 font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-cyan-500/10 transition-all flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Onboard Laboratory
          </button>
        </header>

        {/* WORKSPACE */}
        <div className="p-8 space-y-8 flex-1">
          
          {/* STATS CARDS */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Laboratories</p>
                <h3 className="text-3xl font-extrabold text-white mt-1.5">{loading ? "..." : totalLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/30 text-cyan-400">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Tenants</p>
                <h3 className="text-3xl font-extrabold text-emerald-400 mt-1.5">{loading ? "..." : activeLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/30 text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Suspended Tenants</p>
                <h3 className="text-3xl font-extrabold text-red-500 mt-1.5">{loading ? "..." : suspendedLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/30 text-red-500">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">New (Last 30 days)</p>
                <h3 className="text-3xl font-extrabold text-blue-400 mt-1.5">{loading ? "..." : newLabsThisMonth}</h3>
              </div>
              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-800/30 text-blue-400">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* SEARCH & FILTERS */}
          <section className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/60">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search labs by name, owner, or email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Showing {filteredLabs.length} of {labs.length} Laboratories
            </div>
          </section>

          {/* LABORATORY TABLE CARD */}
          <section className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">Lab Details</th>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Tenant Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Onboarding Date</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="p-4 pl-6">
                          <div className="h-4 w-36 bg-slate-800 rounded mb-1"></div>
                          <div className="h-3 w-24 bg-slate-800/60 rounded"></div>
                        </td>
                        <td className="p-4"><div className="h-4 w-20 bg-slate-800 rounded"></div></td>
                        <td className="p-4"><div className="h-4 w-32 bg-slate-800 rounded"></div></td>
                        <td className="p-4"><div className="h-6 w-16 bg-slate-800 rounded-full"></div></td>
                        <td className="p-4"><div className="h-4 w-24 bg-slate-800 rounded"></div></td>
                        <td className="p-4 pr-6 text-right"><div className="h-8 w-16 bg-slate-800 rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredLabs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        <Building2 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                        <p className="font-semibold text-slate-400">No laboratories found</p>
                        <p className="text-xs text-slate-600 mt-1">Try resetting your search query or onboard a new lab tenant.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLabs.map((lab) => (
                      <tr key={lab.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-white text-base">{lab.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono tracking-wider">{lab.id}</p>
                        </td>
                        <td className="p-4 text-slate-300 font-medium">{lab.owner}</td>
                        <td className="p-4 text-slate-300 font-mono text-xs">{lab.email}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            lab.status === "Active"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${lab.status === "Active" ? "bg-emerald-400" : "bg-red-400"}`}></span>
                            {lab.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs font-mono">{lab.date}</td>
                        <td className="p-4 pr-6 text-right">
                          <button
                            disabled={actionLoading === lab.id}
                            onClick={() => handleToggleStatus(lab.id, lab.status)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border focus:outline-none ${
                              lab.status === "Active"
                                ? "bg-red-950/20 hover:bg-red-950/60 text-red-400 border-red-900/30 active:scale-95"
                                : "bg-emerald-950/20 hover:bg-emerald-950/60 text-emerald-400 border-emerald-900/30 active:scale-95"
                            } disabled:opacity-50`}
                          >
                            {actionLoading === lab.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : lab.status === "Active" ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Block Access
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Activate
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>

      {/* ONBOARD MODAL OVERLAY */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Onboard New Laboratory</h3>
                <p className="text-xs text-slate-400 mt-1">Configure tenant authentication and profiles.</p>
              </div>
              <button 
                onClick={() => setShowOnboardModal(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              
              {/* Lab Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Lab Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Jannat Lab"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-200 text-sm focus:border-cyan-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Owner / Manager</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Javaid Khan"
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-200 text-sm focus:border-cyan-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Login Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. contact@aljannat.lab"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-200 text-sm focus:border-cyan-500 transition-all placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Initial Access Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg outline-none text-slate-200 text-sm focus:border-cyan-500 transition-all placeholder:text-slate-600"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-2">This email and password will be used by staff on the lab login page.</p>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-sm transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-lg text-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Laboratory
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
