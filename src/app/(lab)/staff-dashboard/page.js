"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardPlus, FileText, LogOut, Menu, Plus, Search, Settings, X, Check, ChevronDown, ArrowLeft } from "lucide-react";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import { readStoredBranding, storeBranding } from "@/lib/dashboardBranding";
import LabReportTemplate from "../template/page";

function createPaymentId(prefix, existingPayments = []) {
  let id;
  do {
    id = `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  } while (existingPayments.some((payment) => payment.id === id));
  return id;
}

function createUniquePatientId(prefix = "#01/") {
  return `${prefix}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function getLocalDateString(date = new Date()) {
  const pad = (value) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function StaffDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("Registration");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [branding, setBranding] = useState(readStoredBranding);
  const [patientSearch, setPatientSearch] = useState("");
  const [labId, setLabId] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const storedStaff = window.localStorage.getItem("staff_profile");
        if (storedStaff) {
          const parsed = JSON.parse(storedStaff);
          return parsed?.labId || "";
        }
      } catch (e) {
        // ignore
      }
    }
    return "";
  });
  const [testQueueData, setTestQueueData] = useState([]);
  const [advancePayments, setAdvancePayments] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [regName, setRegName] = useState("");
  const [regContact, setRegContact] = useState("");
  const [regAge, setRegAge] = useState("");
  const [regGender, setRegGender] = useState("male");
  const [regTests, setRegTests] = useState("");
  const [regTotalBill, setRegTotalBill] = useState("");
  const [regAdvancePaid, setRegAdvancePaid] = useState("");
  const [regDiscountType, setRegDiscountType] = useState("flat");
  const [regDiscountValue, setRegDiscountValue] = useState("");

  // Report template multiselect states
  const [reportTemplates, setReportTemplates] = useState([]);
  const [isRegTemplateDropdownOpen, setIsRegTemplateDropdownOpen] = useState(false);
  const [selectedRegTemplates, setSelectedRegTemplates] = useState([]);
  const [regTemplateSearch, setRegTemplateSearch] = useState("");

  // Inline report template editor session state
  const [activeReportPatientData, setActiveReportPatientData] = useState(null);

  // Derived tracking variable for instantaneous math calculations
  const discountAmount = regDiscountType === "percentage"
    ? Math.round(((parseInt(regTotalBill) || 0) * (parseFloat(regDiscountValue) || 0)) / 100)
    : (parseInt(regDiscountValue) || 0);

  const regPendingBalance = Math.max(0, (parseInt(regTotalBill) || 0) - discountAmount - (parseInt(regAdvancePaid) || 0));

  const handleRegTemplateToggle = (tpl) => {
    setSelectedRegTemplates((prev) => {
      const isAlreadySelected = prev.some((item) => item.key === tpl.key);
      let next;
      if (isAlreadySelected) {
        next = prev.filter((item) => item.key !== tpl.key);
      } else {
        next = [...prev, tpl];
      }
      
      const testNames = next.map((item) => item.label).join(", ");
      setRegTests(testNames);
      return next;
    });
  };

  const handleClearSelectedRegTemplates = () => {
    setSelectedRegTemplates([]);
    setRegTests("");
  };

  const handleOpenReportEditor = (patient) => {
    const isCompleted = (patient.status || "").toLowerCase() === "completed" || Boolean(patient.lastReportNumber);
    const data = {
      source: isCompleted ? "report" : "staff",
      reportNumber: patient.lastReportNumber || `${patient.id}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.patient,
      contact: patient.contact || "",
      age: patient.age || "",
      gender: patient.gender || "",
      tests: patient.tests || "",
      registeredAt: patient.registeredAt || "",
      totalBill: String(patient.totalBill || ""),
      pendingBalance: String(patient.pendingBalance || ""),
      refDoctor: patient.refDoctor || "",
      specimen: patient.specimen || "Blood",
    };
    setActiveReportPatientData(data);
  };

  useEffect(() => {
    const storedStaff = typeof window !== "undefined" ? window.localStorage.getItem("staff_profile") : null;
    if (!storedStaff) {
      router.replace("/");
      return;
    }

    let parsedStaff;
    try {
      parsedStaff = JSON.parse(storedStaff);
      if (parsedStaff?.role !== "Staff") {
        router.replace("/");
        return;
      }
    } catch (error) {
      router.replace("/");
      return;
    }

    async function loadPatients() {
      if (!parsedStaff?.labId) return;
      try {
        const url = `/api/patients?labId=${encodeURIComponent(parsedStaff.labId)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!res.ok) {
          console.warn(data.message || "Could not load patients.");
          return;
        }

        if (data.patients) setTestQueueData(data.patients);
        if (data.advancePayments) setAdvancePayments(data.advancePayments);
        if (data.pendingPayments) setPendingPayments(data.pendingPayments);
      } catch (err) {
        console.warn("Patients API is unavailable.", err);
      }
    }

    async function loadBranding() {
      try {
        const res = await fetch("/api/labs");
        if (res.ok) {
          const data = await res.json();
          const requestedLabId = parsedStaff?.labId;
          const activeLab = data.labs?.find((l) => l.id === requestedLabId) || data.labs?.find((l) => l.status === "Active") || data.labs?.[0];
          if (activeLab) {
            const b = activeLab.branding || {};
            const nextBranding = {
              labId: activeLab.id,
              labName: b.labName || activeLab.name || "",
              logoUrl: b.logoUrl || "/",
              tagline: b.tagline || "Clinical Laboratory",
              address: b.address || activeLab.address || "",
              phone: b.phone || activeLab.phone || "  ",
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

    async function loadReportTemplates() {
      try {
        const res = await fetch("/api/report-templates");
        const data = await res.json();
        if (res.ok && data.templates) {
          setReportTemplates(data.templates);
        }
      } catch (err) {
        console.warn("Could not load report templates", err);
      }
    }

    loadPatients();
    loadBranding();
    loadReportTemplates();
  }, [router]);

  const baseMenuItems = [
    { name: "Registration", icon: ClipboardPlus },
    { name: "Report Generated", icon: FileText },
  ];
  const menuItems = (branding.staffMenuOrder || [])
    .map((name) => baseMenuItems.find((item) => item.name === name))
    .filter(Boolean)
    .concat(baseMenuItems.filter((item) => !(branding.staffMenuOrder || []).includes(item.name)));

  const handleBrandingSave = (nextBranding) => {
    setBranding(nextBranding);
    storeBranding(nextBranding);
  };

  const handleLogout = () => {
    localStorage.removeItem("staff_profile");
    router.push("/");
  };

  const todayDate = getLocalDateString();
  const todaysPatients = testQueueData.filter((patient) => patient.registeredAt === todayDate);
  const pendingReports = testQueueData.filter((patient) => (patient.status || "").toLowerCase() !== "completed");
  const completedReports = testQueueData.filter((patient) => {
    const status = (patient.status || "").toLowerCase();
    return status === "completed" || Boolean(patient.lastReportNumber);
  });

  const handlePatientRegistrationSubmit = async (e) => {
    e.preventDefault();

    if (!regName || !regTests || !regTotalBill) {
      toast.error("Please complete patient name, tests, and total bill.");
      return;
    }

    setIsSaving(true);

    const generatedLabId = createUniquePatientId("#01/");
    const capitalizedName = regName.toUpperCase();
    const currentBillTotal = parseInt(regTotalBill) || 0;
    const currentAdvancePaid = parseInt(regAdvancePaid) || 0;

    const queueRecord = {
      id: generatedLabId,
      labId: labId || "",
      patient: capitalizedName,
      contact: regContact,
      age: regAge || "N/A",
      gender: regGender,
      tests: regTests,
      totalBill: currentBillTotal,
      discountType: regDiscountType,
      discountValue: parseFloat(regDiscountValue) || 0,
      discountAmount: discountAmount,
      advancePaid: currentAdvancePaid,
      pendingBalance: regPendingBalance,
      registeredAt: todayDate,
      status: "Pending",
      action: "Collect Sample",
    };

    const advanceRecord = currentAdvancePaid > 0 ? {
      id: createPaymentId("AP", advancePayments),
      labId: labId || "",
      patientName: capitalizedName,
      patientId: generatedLabId,
      amount: currentAdvancePaid,
      date: todayDate,
      status: "Received",
    } : null;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);

    const pendingRecord = regPendingBalance > 0 ? {
      id: createPaymentId("PP", pendingPayments),
      labId: labId || "",
      patientName: capitalizedName,
      patientId: generatedLabId,
      amount: regPendingBalance,
      dueDate: getLocalDateString(dueDate),
      status: "Pending",
    } : null;

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: queueRecord,
          advancePayment: advanceRecord,
          pendingPayment: pendingRecord,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not register patient.");
        return;
      }

      setTestQueueData((prev) => [...prev, queueRecord]);
      if (advanceRecord) setAdvancePayments((prev) => [...prev, advanceRecord]);
      if (pendingRecord) setPendingPayments((prev) => [...prev, pendingRecord]);

      toast.success(data.databaseConnected === false
        ? `Registered ${generatedLabId} in demo mode.`
        : `Registered ${generatedLabId} successfully.`
      );

      setRegName("");
      setRegContact("");
      setRegAge("");
      setRegGender("male");
      setRegTests("");
      setRegTotalBill("");
      setRegAdvancePaid("");
      setRegDiscountType("flat");
      setRegDiscountValue("");
      setSelectedRegTemplates([]);
      setActiveTab("Report Generated");
    } catch (err) {
      console.warn("Patient registration request failed.", err);
      toast.error("Could not register patient. Check database connection.");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      Processing: { bg: "bg-yellow-100", text: "text-yellow-800" },
      Pending: { bg: "bg-orange-100", text: "text-orange-800" },
      Completed: { bg: "bg-green-100", text: "text-green-800" },
    };
    const style = statusMap[status] || { bg: "bg-gray-100", text: "text-gray-800" };
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>{status || "Pending"}</span>;
  };

  const filteredPatients = patientSearch.trim()
    ? testQueueData.filter((patient) => {
        const text = [patient.id, patient.patient, patient.contact, patient.tests, patient.status, patient.registeredAt]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(patientSearch.trim().toLowerCase());
      })
    : testQueueData;

  const renderRegistration = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Staff Patient Registration</h2>
        <p className="text-slate-500 text-sm mt-1">Register a new patient for laboratory tests and billing records.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-semibold uppercase">Today&apos;s Patients</p>
          <h3 className="text-3xl font-bold text-[#004d26] mt-2">{todaysPatients.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-semibold uppercase">Pending Reports</p>
          <h3 className="text-3xl font-bold text-orange-600 mt-2">{pendingReports.length}</h3>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-slate-500 text-xs font-semibold uppercase">Completed Reports</p>
          <h3 className="text-3xl font-bold text-emerald-700 mt-2">{completedReports.length}</h3>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-100 p-8">
        <form className="space-y-6" onSubmit={handlePatientRegistrationSubmit}>
          <h3 className="text-sm font-bold text-[#004d26] uppercase tracking-widest border-b border-slate-100 pb-3">
            Patient & Diagnostic Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Patient Full Name</label>
              <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Enter patient name" className="h-11 border-slate-300" required />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Number</label>
              <Input value={regContact} onChange={(e) => setRegContact(e.target.value)} placeholder="03xx-xxxxxxx" className="h-11 border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Age</label>
              <Input value={regAge} onChange={(e) => setRegAge(e.target.value)} placeholder="e.g. 35" className="h-11 border-slate-300" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
              <Select value={regGender} onValueChange={setRegGender}>
                <SelectTrigger className="h-11 border-slate-300 bg-white">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Report Templates</label>
              <button
                type="button"
                onClick={() => setIsRegTemplateDropdownOpen(!isRegTemplateDropdownOpen)}
                className="flex h-11 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-100"
              >
                <span className="truncate">
                  {selectedRegTemplates.length > 0
                    ? `${selectedRegTemplates.length} selected`
                    : "Choose report template(s)..."}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {isRegTemplateDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsRegTemplateDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in duration-100">
                    <div className="p-1 border-b mb-2">
                      <Input
                        placeholder="Search templates..."
                        value={regTemplateSearch}
                        onChange={(e) => setRegTemplateSearch(e.target.value)}
                        className="h-8 text-xs bg-slate-50 text-black border-slate-300"
                      />
                    </div>
                    <div className="space-y-1">
                      {reportTemplates
                        .filter((tpl) => tpl.label.toLowerCase().includes(regTemplateSearch.toLowerCase()))
                        .map((tpl) => {
                          const isChecked = selectedRegTemplates.some((item) => item.key === tpl.key);
                          return (
                            <label
                              key={tpl.key}
                              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-100 cursor-pointer select-none"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleRegTemplateToggle(tpl)}
                                className="h-4 w-4 rounded-sm border-slate-300 text-[#004d26] focus:ring-emerald-500"
                              />
                              <span className="font-medium text-black">{tpl.label}</span>
                            </label>
                          );
                        })}
                      {reportTemplates.filter((tpl) => tpl.label.toLowerCase().includes(regTemplateSearch.toLowerCase())).length === 0 && (
                        <p className="text-center text-xs text-slate-400 py-2">No templates found</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">Assigned Tests (Editable)</label>
                {selectedRegTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelectedRegTemplates}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <Input 
                placeholder="CBC, ESR, Blood Sugar" 
                className="h-11 border-slate-300" 
                value={regTests}
                onChange={(e) => setRegTests(e.target.value)}
                required 
              />
            </div>
          </div>

          <h3 className="text-sm font-bold text-[#004d26] uppercase tracking-widest border-b border-slate-100 pb-3">
            Billing Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Total Bill (PKR)</label>
              <Input 
                type="number" 
                value={regTotalBill} 
                onChange={(e) => setRegTotalBill(e.target.value)} 
                placeholder="0" 
                className="h-11 border-slate-300 bg-white font-semibold text-slate-800" 
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Discount Type</label>
              <Select value={regDiscountType} onValueChange={(val) => setRegDiscountType(val)}>
                <SelectTrigger className="h-11 border-slate-300 bg-white text-black">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="border-slate-300 text-black mt-2">
                  <SelectItem value="flat">Flat Amount</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Discount Value {regDiscountType === "percentage" ? "(%)" : "(PKR)"}
              </label>
              <Input 
                type="number" 
                placeholder={regDiscountType === "percentage" ? "e.g. 10%" : "e.g. 500"} 
                className="h-11 border-slate-300 bg-white font-semibold text-slate-800" 
                value={regDiscountValue}
                onChange={(e) => setRegDiscountValue(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Advance Paid (PKR)</label>
              <Input 
                type="number" 
                value={regAdvancePaid} 
                onChange={(e) => setRegAdvancePaid(e.target.value)} 
                placeholder="0" 
                className="h-11 border-slate-300 bg-white font-semibold text-emerald-800" 
              />
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-center">
              <p className="text-[10px] font-bold uppercase text-slate-500">Pending Balance</p>
              <p className="text-xl font-bold text-red-600 mt-0.5">PKR {regPendingBalance.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving} className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a] px-8">
              <Plus className="w-4 h-4 mr-2" />
              {isSaving ? "Registering..." : "Register Patient"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Report Generated</h2>
          <p className="text-slate-500 text-sm mt-1">Open registered patient records and generate laboratory reports.</p>
        </div>
        <Button 
          onClick={() => setActiveReportPatientData({
            source: "staff",
            tests: "Laboratory Report"
          })}
          className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Report
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
        <div className="p-5 border-b bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="font-semibold text-slate-700 text-sm">Active Patient Medical Records</div>
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search patient..."
              className="h-10 border-slate-300 pl-9 pr-9 text-slate-800"
            />
            {patientSearch && (
              <button
                type="button"
                onClick={() => setPatientSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label="Clear patient search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Lab ID</th>
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4">Assigned Tests</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((row, index) => (
                <tr key={row.id ? `${row.id}-${index}` : `patient-${index}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{row.id}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">
                    <button 
                      onClick={() => handleOpenReportEditor(row)} 
                      className="text-[#004d26] hover:underline font-medium cursor-pointer text-left border-none bg-transparent"
                    >
                      {row.patient}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{row.tests}</td>
                  <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleOpenReportEditor(row)} 
                      className="inline-flex items-center text-[#004d26] hover:text-[#00361a] text-xs font-semibold cursor-pointer border-none bg-transparent"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Generate Report
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredPatients.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">
                    No patient records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    // Intercept rendering if an active report session is open
    if (activeReportPatientData) {
      return (
        <div className="space-y-4 animate-in fade-in duration-200">
          <Button 
            variant="ghost" 
            onClick={() => setActiveReportPatientData(null)} 
            className="text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
          </Button>
          <div className="bg-white rounded-xl shadow-md border border-slate-100 p-2">
            <LabReportTemplate initialData={activeReportPatientData} />
          </div>
        </div>
      );
    }

    if (activeTab === "Report Generated") return renderReports();
    return renderRegistration();
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {isCustomizerOpen && (
        <DashboardCustomizer
          open={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          branding={branding}
          onSave={handleBrandingSave}
          menuKey="staffMenuOrder"
          menuItems={baseMenuItems}
        />
      )}

      <aside className="hidden lg:flex flex-col w-64 text-white border-r border-emerald-900 z-30 transition-all duration-300" style={{ backgroundColor: branding.primaryColor }}>
        <div className="p-1 border-b border-emerald-900 flex items-center">
          <div className="mx-2 my-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white shrink-0 shadow-md">
            {branding.logoUrl ? (
              <Image src={branding.logoUrl} alt={`${branding.labName} logo`} width={56} height={56} className="h-full w-full object-cover" unoptimized />
            ) : null}
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wider uppercase" style={{ color: branding.accentColor }}>{branding.labName}</h1>
            <p className="text-[10px] text-emerald-100 font-semibold tracking-widest uppercase">{branding.tagline}</p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setActiveReportPatientData(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  activeTab === item.name && !activeReportPatientData
                    ? "bg-yellow-400 text-[#004d26] shadow-md font-bold scale-[1.02]"
                    : "text-emerald-100 hover:bg-emerald-800/60 hover:text-white"
                }`}
                style={activeTab === item.name && !activeReportPatientData ? { backgroundColor: branding.accentColor, color: branding.primaryColor } : undefined}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </button>
            );
          })}
        </nav>
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-emerald-100 hover:bg-emerald-800/60 hover:text-white transition-all"
          >
            <Settings className="h-4 w-4" />
            Edit Dashboard
          </button>
        </div>
        <div className="p-4 border-t border-emerald-900 bg-[#003d1e]">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-950/40 mb-3">
            <div className="w-8 h-8 rounded-full bg-yellow-400 text-[#004d26] flex items-center justify-center font-bold text-xs">ST</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">Staff Member</p>
              <p className="text-[10px] text-emerald-300 truncate">Logged In</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-red-200 bg-red-950/30 hover:bg-red-900/40 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-8 lg:p-12">
        {renderContent()}
      </main>
    </div>
  );
}