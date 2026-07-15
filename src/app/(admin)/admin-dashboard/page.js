"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  Trash2,
  X,
  Mail,
  Lock,
  Calendar,
  CreditCard,
  BadgeCheck,
  Clock,
  DollarSign,
  Save
} from "lucide-react";
import { toast, Toaster } from "sonner";

export default function SuperAdminDashboard() {
  const router = useRouter();
  
  // Dashboard state (fully frontend managed)
  const [labs, setLabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(null); // stores lab ID being updated
  
  // Form state
  const [form, setForm] = useState({
    name: "",
    owner: "",
    email: "",
    password: ""
  });
  const [subscriptionForm, setSubscriptionForm] = useState({
    labId: "",
    plan: "",
    billingCycle: "",
    amount: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    status: "",
    notes: ""
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [subscriptionSubmitting, setSubscriptionSubmitting] = useState(false);

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

    async function loadPatients() {
      try {
        setPatientsLoading(true);
        const token = localStorage.getItem("super_admin_token");
        const res = await fetch("/api/patients", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (res.ok && data.patients) {
          setPatients(data.patients);
        } else {
          console.warn(data.message || "Could not load patient records for admin view.");
        }
      } catch (error) {
        console.error(error);
        toast.error("Could not load patient records. Check your database connection.");
      } finally {
        setPatientsLoading(false);
      }
    }

    loadLabs();
    loadPatients();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch("/api/super-admin/logout", { method: "POST" });
    } catch (error) {
      console.warn("Admin logout API failed", error);
    }

    localStorage.removeItem("super_admin_token");
    toast.success("Logged out successfully");

    if (router?.replace) {
      router.replace("/admin-login");
    } else {
      window.location.href = "/admin-login";
    }
  };

  // Toggle lab status (Client-side only)
  const handleToggleStatus = async (labId, currentStatus) => {
    setActionLoading(labId);
    const newStatus = currentStatus === "Active" ? "Suspended" : "Active" ;
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
      toast.error("Could not update laboratory. Check your credentials or Database");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteLab = async (lab) => {
    const confirmed = window.confirm(`Delete ${lab.name} and its staff accounts from the system?`);
    if (!confirmed) return;

    setActionLoading(lab.id);
    const token = localStorage.getItem("super_admin_token");

    try {
      const res = await fetch("/api/admin/labs", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: lab.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("super_admin_token");
          router.push("/admin-login");
          return;
        }
        throw new Error(data.message || "Could not delete laboratory");
      }

      setLabs(prev => prev.filter((item) => item.id !== lab.id));
      toast.success(`${lab.name} deleted successfully`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not delete laboratory. Check your credentials or Database");
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

  const handleSubscriptionSubmit = (e) => {
    e.preventDefault();

    if (!subscriptionForm.labId || !subscriptionForm.amount || !subscriptionForm.startDate) {
      toast.error("Please complete the required subscription fields");
      return;
    }

    setSubscriptionSubmitting(true);

    const selectedLab = labs.find((lab) => lab.id === subscriptionForm.labId);

    setTimeout(() => {
      toast.success(`${selectedLab?.name || "Laboratory"} subscription saved`);
      setShowSubscriptionModal(false);
      setSubscriptionSubmitting(false);
    }, 400);
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

  const totalPatients = patients.length;
  const recentPatients = [...patients].sort((a, b) => new Date(b.createdAt || b.registeredAt || 0) - new Date(a.createdAt || a.registeredAt || 0)).slice(0, 6);

  // Filter laboratories based on search query
  const filteredLabs = labs.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.owner.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans antialiased selection:bg-teal-500 selection:text-white">
      <Toaster position="top-right" theme="light" richColors />

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between p-6 shrink-0 shadow-sm">
        <div className="space-y-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-color:white flex items-center justify-center font-bold text-white shadow-md shadow-teal-500/20">
              <Image src="/super/softcenteric-logo.webp" alt="Logo" width={40} height={32} className="w-10 h-8" unoptimized />
            </div>
            <div>
              <h1 className="font-extrabold text-slate-900 tracking-wide text-lg">Softcenteric</h1>
              <p className="text-[10px] text-teal-600 font-bold uppercase tracking-widest">Super Admin</p>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold px-3 mb-2">Navigation</p>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-teal-50 text-teal-700 font-semibold text-sm transition-all border-l-2 border-teal-600">
              <Building2 className="w-4 h-4" />
              Laboratories
            </button>
            <button 
              onClick={() => setShowSubscriptionModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 font-medium text-sm transition-all border-l-2 border-transparent"
            >
              <CreditCard className="w-4 h-4" />
              Subscriptions
            </button>
          </nav>
        </div>

        {/* User profile / Logout */}
        <div className="pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-600">
                <Image src="/super/softcenteric-logo.webp" alt="Logo" width={24} height={20} className="w-6 h-5" unoptimized />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Admin Account</p>
                <p className="text-[10px] text-slate-400">System Controller</p>
              </div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all border border-red-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout System
          </button>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col overflow-y-auto max-h-screen">
        
        {/* TOP BAR */}
        <header className="px-8 py-5 border-b border-slate-200 flex justify-between items-center bg-white/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Laboratories Directory</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage and onboard clinical laboratories endpoints.</p>
          </div>
          
          <button 
            onClick={() => setShowOnboardModal(true)}
            className="bg-gradient-to-r from-[#0d9488] to-[#06b6d4] hover:opacity-90 active:scale-95 text-white font-bold px-4 py-2.5 rounded-lg shadow-md shadow-teal-500/10 transition-all flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            Onboard Laboratory
          </button>
        </header>

        {/* WORKSPACE */}
        <div className="p-8 space-y-8 flex-1">
          
          {/* STATS CARDS */}
          <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:bg-teal-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Laboratories</p>
                <h3 className="text-3xl font-extrabold text-slate-900 mt-1.5">{loading ? "..." : totalLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-teal-50 border border-teal-100 text-[#0d9488]">
                <Building2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Tenants</p>
                <h3 className="text-3xl font-extrabold text-emerald-600 mt-1.5">{loading ? "..." : activeLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Suspended Tenants</p>
                <h3 className="text-3xl font-extrabold text-red-600 mt-1.5">{loading ? "..." : suspendedLabs}</h3>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-5 rounded-xl flex items-center justify-between shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all"></div>
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">New (Last 30 days)</p>
                <h3 className="text-3xl font-extrabold text-cyan-600 mt-1.5">{loading ? "..." : newLabsThisMonth}</h3>
              </div>
              <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-600">
                <Calendar className="w-6 h-6" />
              </div>
            </div>
          </section>

          {/* SEARCH & FILTERS */}
          <section className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search labs by name, owner, or email..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Showing {filteredLabs.length} of {labs.length} Laboratories
            </div>
          </section>

          {/* LABORATORY TABLE CARD */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <th className="p-4 pl-6">Lab Details</th>
                    <th className="p-4">Owner</th>
                    <th className="p-4">Tenant Email</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Onboarding Date</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="p-4 pl-6">
                          <div className="h-4 w-36 bg-slate-200 rounded mb-1"></div>
                          <div className="h-3 w-24 bg-slate-100 rounded"></div>
                        </td>
                        <td className="p-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                        <td className="p-4"><div className="h-4 w-32 bg-slate-200 rounded"></div></td>
                        <td className="p-4"><div className="h-6 w-16 bg-slate-200 rounded-full"></div></td>
                        <td className="p-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                        <td className="p-4 pr-6 text-right"><div className="h-8 w-16 bg-slate-200 rounded ml-auto"></div></td>
                      </tr>
                    ))
                  ) : filteredLabs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-400">
                        <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p className="font-semibold text-slate-500">No laboratories found</p>
                        <p className="text-xs text-slate-400 mt-1">Try resetting your search query or onboard a new lab tenant.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLabs.map((lab) => (
                      <tr key={lab.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-slate-900 text-base">{lab.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono tracking-wider">{lab.id}</p>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">{lab.owner}</td>
                        <td className="p-4 text-slate-600 font-mono text-xs">{lab.email}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            lab.status === "Active"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${lab.status === "Active" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                            {lab.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 text-xs font-mono">{lab.date}</td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              disabled={actionLoading === lab.id}
                              onClick={() => handleToggleStatus(lab.id, lab.status)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border focus:outline-none ${
                                lab.status === "Active"
                                  ? "bg-red-50 hover:bg-red-100 text-red-600 border-red-200 active:scale-95"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200 active:scale-95"
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
                            <button
                              disabled={actionLoading === lab.id}
                              onClick={() => handleDeleteLab(lab)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 disabled:opacity-50"
                            >
                              {actionLoading === lab.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* RECENT PATIENTS */}
         
        </div>
      </main>

      {/* ONBOARD MODAL OVERLAY */}
      {showOnboardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-xl space-y-6 relative animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Onboard New Laboratory</h3>
                <p className="text-xs text-slate-500 mt-1">Configure tenant authentication and profiles.</p>
              </div>
              <button 
                onClick={() => setShowOnboardModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleOnboardSubmit} className="space-y-4">
              
              {/* Lab Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Lab Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder=""
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Owner / Manager</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder=""
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Login Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder=""
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Initial Access Password</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">This email and password will be used by staff on the lab login page.</p>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#0d9488] to-[#06b6d4] hover:opacity-90 text-white font-bold rounded-lg text-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {formSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Register Laboratory
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION MODAL OVERLAY */}
      {showSubscriptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl relative animate-in zoom-in-95 duration-200 overflow-hidden">

            {/* Modal Header */}
            <div className="flex justify-between items-start px-6 py-5 border-b border-slate-200 bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-teal-50 border border-teal-100 text-teal-700">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Manage Subscription</h3>
                  <p className="text-xs text-slate-500 mt-1">Assign plan access and billing terms for a laboratory.</p>
                </div>
              </div>
              <button
                onClick={() => setShowSubscriptionModal(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubscriptionSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Laboratory</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      required
                      value={subscriptionForm.labId}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, labId: e.target.value })}
                      className="w-full appearance-none pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                    >
                      <option value="">Select laboratory</option>
                      {labs.map((lab) => (
                        <option key={lab.id} value={lab.id}>{lab.name} - {lab.email}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Plan</label>
                  <div className="relative">
                    <BadgeCheck className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={subscriptionForm.plan}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, plan: e.target.value })}
                      className="w-full appearance-none pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                    >
                      <option>Starter</option>
                      <option>Standard</option>
                      <option>Premium</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Billing Cycle</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={subscriptionForm.billingCycle}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value })}
                      className="w-full appearance-none pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                    >
                      <option>Monthly</option>
                      <option>Quarterly</option>
                      <option>Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Amount</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min="0"
                      required
                      value={subscriptionForm.amount}
                      onChange={(e) => setSubscriptionForm({ ...subscriptionForm, amount: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Status</label>
                  <select
                    value={subscriptionForm.status}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                  >
                    <option>Active</option>
                    <option>Trial</option>
                    <option>Past Due</option>
                    <option>Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={subscriptionForm.startDate}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, startDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">End Date</label>
                  <input
                    type="date"
                    value={subscriptionForm.endDate}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, endDate: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Notes</label>
                  <textarea
                    rows="3"
                    placeholder="Internal billing notes..."
                    value={subscriptionForm.notes}
                    onChange={(e) => setSubscriptionForm({ ...subscriptionForm, notes: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none text-slate-800 text-sm focus:border-teal-500 focus:bg-white transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Selected Plan</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{subscriptionForm.plan}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Billing</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">PKR {subscriptionForm.amount || "0"} / {subscriptionForm.billingCycle}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Access</p>
                  <p className="mt-1 text-sm font-bold text-teal-700">{subscriptionForm.status}</p>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowSubscriptionModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-sm transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={subscriptionSubmitting}
                  className="px-5 py-2 bg-gradient-to-r from-[#0d9488] to-[#06b6d4] hover:opacity-90 text-white font-bold rounded-lg text-sm transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {subscriptionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
