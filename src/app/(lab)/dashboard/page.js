"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FileText,
  Menu,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
  X,
  Check,
  ChevronDown,
  Users,
  FlaskConical,
  ClipboardCheck,
  Wallet,
  LayoutDashboard,
  UserPlus,
  ListChecks,
  BarChart3,
  ShieldCheck,
  Phone,
  CalendarDays,
  UserRound,
  Receipt,
  Banknote,
  AlertTriangle,
  IdCard,
  ReceiptText,
} from "lucide-react";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import { readStoredBranding, storeBranding, normalizeBranding } from "@/lib/dashboardBranding";
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

function getPatientReportHref(patient) {
  if ((patient.status || "").toLowerCase() === "completed" || Boolean(patient.lastReportNumber)) {
    return `/template?source=report&reportNumber=${encodeURIComponent(patient.lastReportNumber)}`;
  }
  const params = new URLSearchParams({
    source: "admin",
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
    specimen: patient.specimen || "",
  });
  return `/template?${params.toString()}`;
}

function formatNumber(value) {
  return value.toLocaleString("en-PK");
}

function formatPKR(value) {
  return value.toLocaleString("en-PK");
}

/* Design Philosophy: Clinical Precision
   - Deep clinical green (#004d26) with a warm amber accent (#FBBF24), refined against
     a cool neutral (slate) canvas so the brand color reads as intentional, not loud.
   - Lab identifiers and report numbers are set in monospace, like specimen labels.
   - Status is always communicated with a color + a dot + a word, never color alone.
   - Cards use a single consistent elevation system (border + soft shadow on hover).
   - Motion is restrained: 150-200ms ease transitions on hover/focus only.
*/

// Lookup used only for presentational stat icons on the Overview screen.
const STAT_ICONS = {
  "Today's Patients": Users,
  "Pending Tests": FlaskConical,
  "Completed Reports": ClipboardCheck,
  "Revenue (PKR)": Wallet,
};

const NAV_ICONS = {
  "Overview": LayoutDashboard,
  "New Registration": UserPlus,
  "Patient Records": IdCard,
  "Revenue": Wallet,
  "Reports": BarChart3,
};

function StatusBadge({ status }) {
  const statusMap = {
    Processing: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", ring: "ring-amber-200" },
    Pending: { dot: "bg-orange-500", text: "text-orange-700", bg: "bg-orange-50", ring: "ring-orange-200" },
    Completed: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" },
    Received: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", ring: "ring-emerald-200" },
    Overdue: { dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50", ring: "ring-red-200" },
  };
  const style = statusMap[status] || { dot: "bg-slate-400", text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [branding, setBranding] = useState(readStoredBranding);
  const [patientSearch, setPatientSearch] = useState("");
  const [recordsSearch, setRecordsSearch] = useState("");
  const [recordsStatusFilter, setRecordsStatusFilter] = useState("all");
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", password: "", role: "Staff" });
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [labStaff, setLabStaff] = useState([]);
  const [currentLabId, setCurrentLabId] = useState("");
  const [deletingPatientId, setDeletingPatientId] = useState(null);
  
  // Registration Form States
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
      
      if (next.length > 0) {
        setRegSpecimen(next[0].specimen || "Blood");
      } else {
        setRegSpecimen("");
      }
      
      return next;
    });
  };

  const handleClearSelectedRegTemplates = () => {
    setSelectedRegTemplates([]);
    setRegTests("");
    setRegSpecimen("");
  };

  const handleOpenReportEditor = (patient) => {
    const isCompleted = (patient.status || "").toLowerCase() === "completed" || Boolean(patient.lastReportNumber);
    const data = {
      source: isCompleted ? "report" : "admin",
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
      specimen: patient.specimen || "",
    };
    setActiveReportPatientData(data);
  };

  // Finance state management
  const [advancePayments, setAdvancePayments] = useState([]);
  
  const [pendingPayments, setPendingPayments] = useState([]);
  
  const [showAdvancePaymentForm, setShowAdvancePaymentForm] = useState(false);
  const [showPendingPaymentForm, setShowPendingPaymentForm] = useState(false);
  const [newAdvancePayment, setNewAdvancePayment] = useState({ patientName: "", patientId: "", amount: "" });
  const [newPendingPayment, setNewPendingPayment] = useState({ patientName: "", patientId: "", amount: "", dueDate: "" });

  // Core system active dynamic test queue arrays
  const [testQueueData, setTestQueueData] = useState([]);
  const [reportsList, setReportsList] = useState([]);

  useEffect(() => {
    async function loadPatients() {
      try {
        const url = currentLabId ? `/api/patients?labId=${encodeURIComponent(currentLabId)}` : "/api/patients";
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
        console.warn("Patients API is unavailable. Showing local demo data.", err);
      }
    }

    async function loadLabContext() {
      try {
        const storedLab = typeof window !== "undefined" ? window.localStorage.getItem("lab_profile") : null;
        let resolvedLabId = "";

        if (storedLab) {
          const parsed = JSON.parse(storedLab);
          if (parsed?.id) {
            resolvedLabId = parsed.id;
          }
        }

        const res = await fetch("/api/labs");
        if (!res.ok) {
          if (resolvedLabId) setCurrentLabId(resolvedLabId);
          return;
        }

        const data = await res.json();
        const lab = data.labs?.find((item) => item.id === resolvedLabId) || data.labs?.find((item) => item.status === "Active") || data.labs?.[0] || null;
        if (lab) {
          if (lab.id) setCurrentLabId(lab.id);
          if (lab.branding) {
            const nextBranding = normalizeBranding(lab.branding);
            setBranding(nextBranding);
            storeBranding(nextBranding);
          }
        } else if (resolvedLabId) {
          setCurrentLabId(resolvedLabId);
        }
      } catch (err) {
        console.warn("Could not load lab context", err);
      }
    }

    async function loadStaffAccounts() {
      if (!currentLabId) return;
      try {
        const res = await fetch(`/api/staff?labId=${encodeURIComponent(currentLabId)}`);
        if (!res.ok) return;
        const data = await res.json();
        setLabStaff(data.staff || []);
      } catch (err) {
        console.warn("Staff accounts API is unavailable.", err);
      }
    }

    async function loadReports() {
      if (!currentLabId) return;
      try {
        const res = await fetch(`/api/reports?labId=${encodeURIComponent(currentLabId)}`);
        const data = await res.json();
        if (!res.ok) return;
        setReportsList(data.reports || []);
      } catch (err) {
        console.warn("Could not load saved reports", err);
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
    loadLabContext();
    loadStaffAccounts();
    loadReports();
    loadReportTemplates();
  }, [currentLabId]);

  // Selected patient for interactive report generator modal
  const [selectedReportPatient, setSelectedReportPatient] = useState(null);
  const [reportFindings, setReportFindings] = useState("");
  const [isReportSaving, setIsReportSaving] = useState(false);

  // Menu items with icons
  const baseMenuItems = [
    { name: "Overview", icon: "📊" },
    { name: "New Registration", icon: "📝" },
    { name: "Patient Records", icon: "🗂️" },
    { name: "Revenue", icon: "💰" },
    { name: "Reports", icon: "📈" },
  ];

  const menuItems = (branding.dashboardMenuOrder || [])
    .map((name) => baseMenuItems.find((item) => item.name === name))
    .filter(Boolean)
    .concat(baseMenuItems.filter((item) => !(branding.dashboardMenuOrder || []).includes(item.name)));

  const handleBrandingSave = (nextBranding) => {
    setBranding(nextBranding);
    storeBranding(nextBranding);
  };

  // Stats computation parameters
  const todayDate = getLocalDateString();
  const todaysPatients = testQueueData.filter((patient) => patient.registeredAt === todayDate);
  const pendingTests = testQueueData.filter((patient) => (patient.status || "").toLowerCase() !== "completed");
  const completedReports = testQueueData.filter((patient) => {
    const status = (patient.status || "").toLowerCase();
    return status === "completed" || Boolean(patient.lastReportNumber);
  });
  const todayRevenue = advancePayments
    .filter((payment) => payment.date === todayDate && (payment.status || "").toLowerCase() === "received")
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const completedPercent = testQueueData.length
    ? Math.round((completedReports.length / testQueueData.length) * 100)
    : 0;

  const stats = [
    { label: "Today's Patients", value: formatNumber(todaysPatients.length), icon: "👥", change: "", type: "positive" },
    { label: "Pending Tests", value: formatNumber(pendingTests.length), icon: "🧪", change: pendingTests.length ? "Action Needed" : "Clear", type: "warning" },
    { label: "Completed Reports", value: formatNumber(completedReports.length), icon: "📄", change: `${completedPercent}% Done`, type: "info" },
    { label: "Revenue (PKR)", value: formatPKR(todayRevenue), icon: "💰", change: "Today", type: "neutral" },
  ];

  // Logic pipeline execution when a new registration occurs
  const handlePatientRegistrationSubmit = async (e) => {
    e.preventDefault();

    if (!regName || !regTests || !regTotalBill) {
      toast.error("Please complete all necessary diagnostic and billing parameters");
      return;
    }

    const generatedLabId = createUniquePatientId("#01/");
    const capitalizedName = regName.toUpperCase();
    const currentBillTotal = parseInt(regTotalBill, 10) || 0;
    const currentAdvancePaid = parseInt(regAdvancePaid, 10) || 0;

    // 1. Append directly to active operating laboratory grid queue
    const queueRecord = {
      id: generatedLabId,
      labId: currentLabId || null,
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
      registeredAt: regDateTime ? regDateTime.slice(0, 10) : new Date().toISOString().split('T')[0],
      dateTime: regDateTime,
      refDoctor: regRefDoctor,
      specimen: regSpecimen,
      status: "Pending",
      action: "Collect Sample"
    };

    const advanceRecord = currentAdvancePaid > 0 ? {
      id: createPaymentId("AP", advancePayments),
      patientName: capitalizedName,
      patientId: generatedLabId,
      amount: currentAdvancePaid,
      date: new Date().toISOString().split('T')[0],
      status: "Received"
    } : null;

    const standardFallbackDate = new Date();
    standardFallbackDate.setDate(standardFallbackDate.getDate() + 3);
    const pendingRecord = regPendingBalance > 0 ? {
      id: createPaymentId("PP", pendingPayments),
      patientName: capitalizedName,
      patientId: generatedLabId,
      amount: regPendingBalance,
      dueDate: standardFallbackDate.toISOString().split('T')[0],
      status: "Pending"
    } : null;

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient: queueRecord,
          advancePayment: advanceRecord,
          pendingPayment: pendingRecord
        })
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Could not register patient.");
        return;
      }

      setTestQueueData((prev) => [...prev, queueRecord]);

      // 2. Automated Financial processing tracking based on pricing attributes configured
      // If there is any advance deposited, log the advance structure immediately
      if (advanceRecord) {
        setAdvancePayments((prev) => [...prev, advanceRecord]);
      }

      // If an outstanding balance remains, link a target accounts receivable entity automatically
      if (pendingRecord) {
        setPendingPayments((prev) => [...prev, pendingRecord]);
      }

      toast.success(data.databaseConnected === false
        ? `Registered ${generatedLabId} in demo mode.`
        : `Registered! Linked ${generatedLabId} successfully to MongoDB.`
      );
      
      // Automatically switch to the live queue to show the newly registered patient.
      setActiveTab("Test Queue");
      
      // Purge input states back to initialization points safely
      setRegName("");
      setRegContact("");
      setRegAge("");
      setRegTests("");
      setRegTotalBill("");
      setRegAdvancePaid("");
      setRegRefDoctor("");
      setRegSpecimen("");
      setRegDiscountType("flat");
      setRegDiscountValue("");
      setSelectedRegTemplates([]);
      setRegDateTime(new Date().toISOString().slice(0, 16));
    } catch (err) {
      console.warn("Patient registration request failed.", err);
      toast.error("Could not register patient. Check database connection.");
    }
  };

  // Helper functions for Manual Finance operations
  const handleAddAdvancePayment = () => {
    if (newAdvancePayment.patientName && newAdvancePayment.amount) {
      const newPayment = {
        id: createPaymentId("AP", advancePayments),
        patientName: newAdvancePayment.patientName.toUpperCase(),
        patientId: newAdvancePayment.patientId || "N/A",
        amount: parseInt(newAdvancePayment.amount),
        date: new Date().toISOString().split('T')[0],
        status: "Received"
      };
      setAdvancePayments([...advancePayments, newPayment]);
      setNewAdvancePayment({ patientName: "", patientId: "", amount: "" });
      setShowAdvancePaymentForm(false);
      toast.success(`Advance payment of PKR ${newPayment.amount} added for ${newPayment.patientName}`);
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const handleAddPendingPayment = () => {
    if (newPendingPayment.patientName && newPendingPayment.amount && newPendingPayment.dueDate) {
      const newPayment = {
        id: createPaymentId("PP", pendingPayments),
        patientName: newPendingPayment.patientName.toUpperCase(),
        patientId: newPendingPayment.patientId || "N/A",
        amount: parseInt(newPendingPayment.amount),
        dueDate: newPendingPayment.dueDate,
        status: "Pending"
      };
      setPendingPayments([...pendingPayments, newPayment]);
      setNewPendingPayment({ patientName: "", patientId: "", amount: "", dueDate: "" });
      setShowPendingPaymentForm(false);
      toast.success(`Pending payment of PKR ${newPayment.amount} added for ${newPayment.patientName}`);
    } else {
      toast.error("Please fill in all required fields");
    }
  };

  const handleMarkAsPaid = async (id, amount, name) => {
    // Find matching patient by ID from the payment reference
    const paymentItem = pendingPayments.find(p => p.id === id);
    if (!paymentItem || !paymentItem.patientId) {
      toast.error("Could not locate patient associated with this payment.");
      return;
    }

    const patientId = paymentItem.patientId;
    const patientObj = testQueueData.find(p => p.id === patientId);
    
    if (patientObj) {
      const newAdvance = (patientObj.advancePaid || 0) + amount;
      const newPending = Math.max(0, (patientObj.pendingBalance || 0) - amount);
      const collectedPaymentId = createPaymentId("AP", advancePayments);

      try {
        const res = await fetch("/api/patients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: patientId,
            pendingPaymentId: id,
            advancePaid: newAdvance,
            pendingBalance: newPending,
            advancePayment: {
              id: collectedPaymentId,
              patientName: name,
              patientId,
              amount,
              date: new Date().toISOString().split('T')[0],
              status: "Received"
            }
          })
        });

        if (!res.ok) throw new Error("Failed to update payment status in database");

        // Update local state if API succeeded
        setTestQueueData((prev) =>
          prev.map((p) => (p.id === patientId ? { ...p, advancePaid: newAdvance, pendingBalance: newPending } : p))
        );
        setPendingPayments((prev) => prev.filter((p) => p.id !== id));
        setAdvancePayments((prev) => [
          ...prev,
          {
            id: collectedPaymentId,
            patientName: name,
            patientId: patientId,
            amount: amount,
            date: new Date().toISOString().split("T")[0],
            status: "Received",
          },
        ]);
        
        toast.success(`Invoiced payment of PKR ${amount} collected and saved to database!`);
      } catch (err) {
        console.error(err);
        toast.error("Could not record payment. Check database connection.");
      }
    } else {
      toast.error("Patient details not found.");
    }
  };

  // Print function logic for laboratory parameters
  const handleCompileAndPrintReport = async (e) => {
    e.preventDefault();
    if (!selectedReportPatient) {
      toast.error("No patient selected to compile report.");
      return;
    }

    if (!reportFindings.trim()) {
      toast.error("Please enter the report findings before finalizing.");
      return;
    }

    setIsReportSaving(true);

    try {
      const reportNumber = `${selectedReportPatient.id}-${Date.now()}`;
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportNumber,
          patientId: selectedReportPatient.id,
          patientName: selectedReportPatient.patient,
          patientContact: selectedReportPatient.contact || null,
          patientAge: selectedReportPatient.age || null,
          patientGender: selectedReportPatient.gender || null,
          totalBill: selectedReportPatient.totalBill || null,
          pendingBalance: selectedReportPatient.pendingBalance || null,
          registeredAt: selectedReportPatient.registeredAt || null,
          labId: selectedReportPatient.labId || "default-lab",
          tests: selectedReportPatient.tests,
          status: "Completed",
          findings: reportFindings,
          createdAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save the report.");
      }

      // Update patient record in DB with last report metadata
      try {
        await fetch("/api/patients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: selectedReportPatient.id,
            status: "Completed",
            lastReportNumber: reportNumber,
            action: "View Report",
            updatedAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.warn("Could not update patient after saving report", e);
      }

      // Update local state to reflect saved report
      setTestQueueData((prev) => prev.map((p) => p.id === selectedReportPatient.id ? { ...p, status: "Completed", lastReportNumber: reportNumber, action: "View Report" } : p));

      // Reflect the freshly saved report immediately in the Reports list
      // (previously this relied solely on a refetch, so a newly created report
      // could appear missing until the next reload)
      setReportsList((prev) => [
        {
          reportNumber,
          patientId: selectedReportPatient.id,
          patientName: selectedReportPatient.patient,
          status: "Completed",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      toast.success("Report saved successfully and patient details updated.");
      setSelectedReportPatient(null);
      setReportFindings("");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Report save failed. Please try again.");
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleAutoCompileReport = async (patient) => {
    const defaultFindings = `Report generated automatically for ${patient.patient}. All assays are compiled under the completed report.`;
    setIsReportSaving(true);

    try {
      const reportNumber = `${patient.id}-${Date.now()}`;
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportNumber,
          patientId: patient.id,
          patientName: patient.patient,
          patientContact: patient.contact || null,
          patientAge: patient.age || null,
          patientGender: patient.gender || null,
          totalBill: patient.totalBill || null,
          pendingBalance: patient.pendingBalance || null,
          registeredAt: patient.registeredAt || null,
          labId: patient.labId || "default-lab",
          tests: patient.tests,
          status: "Completed",
          findings: defaultFindings,
          createdAt: new Date().toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to generate report.");
      }

      // Update patient record in DB
      try {
        await fetch("/api/patients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: patient.id,
            status: "Completed",
            lastReportNumber: reportNumber,
            action: "View Report",
            updatedAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        console.warn("Could not update patient after auto report save", e);
      }

      setTestQueueData((prev) => prev.map((row) => row.id === patient.id ? { ...row, status: "Completed", lastReportNumber: reportNumber, action: "View Report" } : row));

      setReportsList((prev) => [
        {
          reportNumber,
          patientId: patient.id,
          patientName: patient.patient,
          status: "Completed",
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      toast.success("Report compiled and saved automatically.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Auto report generation failed.");
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.name || !staffForm.email || !staffForm.password) {
      toast.error("Please fill in the staff name, email, and password.");
      return;
    }

    if (!currentLabId) {
      toast.error("Lab context is unavailable. Please log in again.");
      return;
    }

    setIsCreatingStaff(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...staffForm,
          labId: currentLabId,
          requesterRole: "LabAdmin",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Could not create staff account.");
      }

      setLabStaff((prev) => [data.staff, ...prev]);
      setStaffForm({ name: "", email: "", password: "", role: "Staff" });
      setIsStaffFormOpen(false);
      toast.success(`Staff account for ${data.staff.email} created successfully.`);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not create staff account.");
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const handleDeletePatient = async (patientId) => {
    if (!patientId) return;

    const confirmed = window.confirm("Delete this patient record from the database?");
    if (!confirmed) return;

    setDeletingPatientId(patientId);
    try {
      const res = await fetch(`/api/patients?id=${encodeURIComponent(patientId)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete patient.");
      }

      setTestQueueData((prev) => prev.filter((row) => row.id !== patientId));
      setAdvancePayments((prev) => prev.filter((payment) => payment.patientId !== patientId));
      setPendingPayments((prev) => prev.filter((payment) => payment.patientId !== patientId));
      if (selectedReportPatient?.id === patientId) {
        setSelectedReportPatient(null);
      }
      toast.success("Patient deleted successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not delete patient.");
    } finally {
      setDeletingPatientId(null);
    }
  };

  const totalAdvancePayments = advancePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPendingPayments = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  const normalizedPatientSearch = patientSearch.trim().toLowerCase();

  const isSamePatientPayment = (payment, patient) => {
    return payment.patientId === patient.id || payment.patientName.toLowerCase() === patient.patient.toLowerCase();
  };

  const getPatientPaymentDetails = (patient) => {
    const advances = advancePayments.filter((payment) => isSamePatientPayment(payment, patient));
    const pendings = pendingPayments.filter((payment) => isSamePatientPayment(payment, patient));
    const advanceTotal = advances.reduce((sum, payment) => sum + payment.amount, 0);
    const pendingTotal = pendings.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      advances,
      pendings,
      advanceTotal,
      pendingTotal,
      totalBill: patient.totalBill || advanceTotal + pendingTotal,
      pendingBalance: patient.pendingBalance ?? pendingTotal,
    };
  };

  const searchedPatients = normalizedPatientSearch
    ? testQueueData.filter((patient) => {
        const payments = [
          ...advancePayments.filter((payment) => isSamePatientPayment(payment, patient)),
          ...pendingPayments.filter((payment) => isSamePatientPayment(payment, patient)),
        ];
        const searchableText = [
          patient.id,
          patient.patient,
          patient.contact,
          patient.age,
          patient.gender,
          patient.tests,
          patient.status,
          patient.registeredAt,
          ...payments.flatMap((payment) => [payment.id, payment.patientId, payment.patientName, payment.status]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchableText.includes(normalizedPatientSearch);
      })
    : [];
  const selectedPatientDetail = searchedPatients[0] || null;
  const selectedPatientPayments = selectedPatientDetail ? getPatientPaymentDetails(selectedPatientDetail) : null;

  const getStatusBadge = (status) => <StatusBadge status={status} />;

  // Presentational filtering for the Patient Records section — full-detail view
  // of every registered patient (examination, reference doctor, fees, specimen).
  const normalizedRecordsSearch = recordsSearch.trim().toLowerCase();
  const recordsFilteredPatients = testQueueData.filter((patient) => {
    const matchesStatus =
      recordsStatusFilter === "all" ||
      (patient.status || "Pending").toLowerCase() === recordsStatusFilter.toLowerCase();
    if (!matchesStatus) return false;
    if (!normalizedRecordsSearch) return true;
    const haystack = [
      patient.id,
      patient.patient,
      patient.contact,
      patient.refDoctor,
      patient.specimen,
      patient.tests,
      patient.status,
      patient.registeredAt,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedRecordsSearch);
  });

  // Shared handler: takes a patient row and routes to the correct Reports action.
  // - If already completed, jump straight to the Reports tab so they can view it.
  // - If still pending/processing, open the compile modal for that patient right there.
  // This is the fix: previously the Test Queue button pointed at a "Result Entry"
  // tab that no longer exists, and the Overview button switched tabs without ever
  // setting selectedReportPatient, so newly registered patients had no path into Reports.
  const handleRowReportAction = (row) => {
    setActiveTab("Reports");
    if ((row.status || "").toLowerCase() !== "completed") {
      setSelectedReportPatient(row);
    }
  };
  const [regRefDoctor, setRegRefDoctor] = useState("");
  const [regDateTime, setRegDateTime] = useState(new Date().toISOString().slice(0, 16)); // Defaults to current system time
  const [regSpecimen, setRegSpecimen] = useState("");

  // Contact lookup logic for existing patients
  const cleanedContact = regContact.replace(/\D/g, "");
  const matchingPatients = cleanedContact.length >= 7
    ? testQueueData.filter((p) => p.contact && p.contact.replace(/\D/g, "") === cleanedContact)
    : [];

  // De-duplicate matching results by patient name (unique patient profile)
  const uniqueMatchingPatients = [];
  const seenNames = new Set();
  for (const p of matchingPatients) {
    const normName = (p.patient || "").trim().toUpperCase();
    if (normName && !seenNames.has(normName)) {
      seenNames.add(normName);
      uniqueMatchingPatients.push(p);
    }
  }

  const [deletingReportNumber, setDeletingReportNumber] = useState(null);

  const handleDeleteReport = async (reportNumberOrId) => {
    const reportNumber = reportNumberOrId;
    if (!reportNumber) return;

    if (!confirm("Are you sure you want to delete this report permanently?")) return;

    setDeletingReportNumber(reportNumber);
    try {
      const res = await fetch(`/api/reports?reportNumber=${encodeURIComponent(reportNumber)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete report");
      }

      // Immediate UI sync
      setReportsList((prev) => prev.filter((rep) => rep.reportNumber !== reportNumber));

      toast.success("Report deleted successfully.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not delete report.");
    } finally {
      setDeletingReportNumber(null);
    }
  };


  // Content Switching Router
  const renderContent = () => {
    switch (activeTab) {
      case "Overview":
        return (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Dashboard</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Overview</h2>
                <p className="text-slate-500 text-sm mt-1.5">Welcome back, Admin Staff — here&apos;s where the lab stands today.</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <Button onClick={() => setActiveTab("New Registration")} className="flex-1 md:flex-none bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg shadow-sm font-semibold">
                  <Plus className="w-4 h-4 mr-2" />
                  New Patient
                </Button>
                <Button onClick={() => setIsStaffFormOpen((prev) => !prev)} variant="outline" className="border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Staff
                </Button>
              </div>
            </div>

            {isStaffFormOpen && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Create staff dashboard account</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Gives a teammate their own login for the staff dashboard, tied to this lab.</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setIsStaffFormOpen(false)} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <form onSubmit={handleCreateStaff} className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Staff name</label>
                    <Input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="e.g. Ali Khan" required className="rounded-lg border-slate-300 focus-visible:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                    <Input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} placeholder="staff@yourlab.com" required className="rounded-lg border-slate-300 focus-visible:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                    <Input type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="Create a secure password" required className="rounded-lg border-slate-300 focus-visible:ring-emerald-200" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
                    <Input value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} placeholder="Staff" className="rounded-lg border-slate-300 focus-visible:ring-emerald-200" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={isCreatingStaff} className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg font-semibold">
                      {isCreatingStaff ? "Creating…" : "Create staff account"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Find patient details</h3>
                  <p className="text-slate-500 text-sm mt-1">Search by lab ID, patient name, contact, test, receipt, or invoice.</p>
                </div>
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient details…"
                    className="h-10 rounded-lg border-slate-300 pl-9 pr-9 text-slate-800 focus-visible:ring-emerald-200"
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

              {normalizedPatientSearch && (
                selectedPatientDetail ? (
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    {/* Identity header — reads like a lab record card */}
                    <div className="relative px-6 py-5 bg-[#004d26] overflow-hidden">
                      <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/5" />
                      <div className="absolute -right-2 bottom-0 h-20 w-20 rounded-full bg-white/5" />
                      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className="h-14 w-14 shrink-0 rounded-2xl bg-amber-300 text-[#004d26] flex items-center justify-center text-lg font-black uppercase shadow-inner">
                            {(selectedPatientDetail.patient || "?").slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-200/70">Matched patient record</p>
                            <h4 className="text-2xl font-bold text-white mt-0.5 truncate">{selectedPatientDetail.patient}</h4>
                            <div className="flex items-center gap-1.5 mt-1 text-emerald-100/80">
                              <IdCard className="h-3.5 w-3.5" />
                              <p className="text-xs font-mono tracking-wide">{selectedPatientDetail.id}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {searchedPatients.length > 1 && (
                            <Badge className="bg-white/10 text-emerald-50 hover:bg-white/10 rounded-full font-medium border-0">
                              {searchedPatients.length} matches
                            </Badge>
                          )}
                          <span className="rounded-full bg-white px-3 py-1">{getStatusBadge(selectedPatientDetail.status)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 space-y-6 bg-slate-50/50">
                      {/* Quick facts strip */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {[
                          { label: "Contact", value: selectedPatientDetail.contact || "N/A", icon: Phone },
                          { label: "Age / Gender", value: `${selectedPatientDetail.age || "N/A"} · ${selectedPatientDetail.gender || "N/A"}`, icon: UserRound },
                          { label: "Registered", value: selectedPatientDetail.registeredAt || "N/A", icon: CalendarDays },
                          { label: "Tests", value: selectedPatientDetail.tests, icon: FlaskConical },
                        ].map((fact, idx) => (
                          <div key={idx} className="rounded-xl bg-white border border-slate-200 p-4 flex items-start gap-3">
                            <span className="h-8 w-8 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center">
                              <fact.icon className="h-4 w-4 text-[#004d26]" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{fact.label}</p>
                              <p className="font-semibold text-slate-800 text-sm mt-0.5 truncate" title={fact.value}>{fact.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Billing summary with a visual settlement bar */}
                      <div className="rounded-xl bg-white border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-bold text-slate-800">Billing summary</p>
                          <p className="text-xs text-slate-400 font-medium">
                            {selectedPatientPayments.totalBill > 0
                              ? `${Math.round((selectedPatientPayments.advanceTotal / selectedPatientPayments.totalBill) * 100)}% settled`
                              : "No bill recorded"}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center">
                              <Receipt className="h-4 w-4 text-slate-600" />
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total bill</p>
                              <p className="text-lg font-bold text-slate-900 tabular-nums">PKR {selectedPatientPayments.totalBill.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 shrink-0 rounded-xl bg-emerald-50 flex items-center justify-center">
                              <Banknote className="h-4 w-4 text-emerald-600" />
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Advance received</p>
                              <p className="text-lg font-bold text-emerald-700 tabular-nums">PKR {selectedPatientPayments.advanceTotal.toLocaleString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 shrink-0 rounded-xl bg-red-50 flex items-center justify-center">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                            </span>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Pending balance</p>
                              <p className="text-lg font-bold text-red-600 tabular-nums">PKR {selectedPatientPayments.pendingBalance.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>

                        {selectedPatientPayments.totalBill > 0 && (
                          <div className="mt-5">
                            <div className="h-2 w-full rounded-full bg-red-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.round((selectedPatientPayments.advanceTotal / selectedPatientPayments.totalBill) * 100))}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[10px] font-semibold text-emerald-600">Received</span>
                              <span className="text-[10px] font-semibold text-red-500">Outstanding</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Receipts & invoices */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 bg-emerald-50/60 border-b border-slate-200 flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-emerald-700" />
                            <p className="text-sm font-bold text-slate-800">Advance receipts</p>
                            <span className="ml-auto text-[10px] font-bold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                              {selectedPatientPayments.advances.length}
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                            {selectedPatientPayments.advances.length ? selectedPatientPayments.advances.map((payment) => (
                              <div key={payment.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-slate-50/70 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 font-mono text-xs truncate">{payment.id}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{payment.date} · {payment.status}</p>
                                  </div>
                                </div>
                                <p className="font-bold text-emerald-700 tabular-nums shrink-0">PKR {payment.amount.toLocaleString()}</p>
                              </div>
                            )) : (
                              <p className="px-4 py-6 text-sm text-slate-400 text-center">No advance receipt found.</p>
                            )}
                          </div>
                        </div>

                        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
                          <div className="px-4 py-3 bg-red-50/60 border-b border-slate-200 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <p className="text-sm font-bold text-slate-800">Pending invoices</p>
                            <span className="ml-auto text-[10px] font-bold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
                              {selectedPatientPayments.pendings.length}
                            </span>
                          </div>
                          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                            {selectedPatientPayments.pendings.length ? selectedPatientPayments.pendings.map((payment) => (
                              <div key={payment.id} className="px-4 py-3 flex items-center justify-between gap-3 text-sm hover:bg-slate-50/70 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                                  <div className="min-w-0">
                                    <p className="font-semibold text-slate-700 font-mono text-xs truncate">{payment.id}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Due {payment.dueDate} · {payment.status}</p>
                                  </div>
                                </div>
                                <p className="font-bold text-red-600 tabular-nums shrink-0">PKR {payment.amount.toLocaleString()}</p>
                              </div>
                            )) : (
                              <p className="px-4 py-6 text-sm text-slate-400 text-center">No pending invoice found.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <Search className="h-6 w-6 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No patient found for &quot;{patientSearch}&quot;.</p>
                  </div>
                )
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ShieldCheck className="h-4 w-4 text-[#004d26]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Lab staff accounts</h3>
                    <p className="text-sm text-slate-500">Accounts created here can sign in to the staff dashboard.</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5">
                {labStaff.length ? labStaff.map((staff) => (
                  <div key={staff.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-[#004d26] text-amber-300 flex items-center justify-center text-xs font-bold uppercase">
                        {(staff.name || "?").slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{staff.name}</p>
                        <p className="text-xs text-slate-500">{staff.email}</p>
                      </div>
                    </div>
                    <Badge className="bg-[#004d26] text-amber-300 hover:bg-[#004d26] rounded-full font-semibold">{staff.role || "Staff"}</Badge>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500 py-2">No staff accounts created yet.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {stats.map((stat, i) => {
                const StatIcon = STAT_ICONS[stat.label] || Wallet;
                const accentMap = {
                  positive: { chip: "bg-emerald-50 text-emerald-700", text: "text-emerald-600" },
                  warning: { chip: "bg-amber-50 text-amber-700", text: "text-amber-600" },
                  info: { chip: "bg-sky-50 text-sky-700", text: "text-sky-600" },
                  neutral: { chip: "bg-slate-100 text-slate-700", text: "text-slate-500" },
                };
                const accent = accentMap[stat.type] || accentMap.neutral;
                return (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">{stat.label}</p>
                        <h3 className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">{stat.value}</h3>
                      </div>
                      <span className={`h-11 w-11 rounded-xl flex items-center justify-center ${accent.chip} group-hover:scale-105 transition-transform duration-200`}>
                        <StatIcon className="h-5 w-5" />
                      </span>
                    </div>
                    {stat.change && (
                      <p className={`text-xs mt-3 font-semibold ${accent.text}`}>
                        {stat.change}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg">Recent test queue</h3>
                  <button onClick={() => setActiveTab("Test Queue")} className="text-xs font-semibold text-[#004d26] hover:underline">View all</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3.5">Lab ID</th>
                        <th className="px-6 py-3.5">Patient</th>
                        <th className="px-6 py-3.5">Tests</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {testQueueData.slice(-4).reverse().map((row, i) => (
                        <tr key={row.id ? `${row.id}-${i}` : i} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-700 font-mono text-xs">{row.id}</td>
                          <td className="px-6 py-4 text-slate-700 font-medium">{row.patient}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{row.tests}</td>
                          <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                onClick={() => handleOpenReportEditor(row)}
                                className="text-[#004d26] text-xs font-semibold hover:text-[#00341a] hover:bg-emerald-50 rounded-lg h-8 px-2.5"
                              >
                                {row.action}
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() => handleDeletePatient(row.id)}
                                disabled={deletingPatientId === row.id}
                                className="text-red-600 text-xs font-semibold hover:text-red-700 hover:bg-red-50 rounded-lg h-8 px-2.5"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                {deletingPatientId === row.id ? "Deleting" : "Delete"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!testQueueData.length && (
                        <tr>
                          <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">No patients registered yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl shadow-sm border border-emerald-100 p-6 bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-white">
                  <div className="flex items-center justify-between">
                    <p className="text-emerald-700 text-[11px] font-bold uppercase tracking-wider">Tests completed</p>
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h4 className="text-3xl font-bold text-emerald-800 mt-2 tabular-nums">{formatNumber(completedReports.length)}</h4>
                  <p className="text-emerald-600/80 text-xs mt-2">All time, this lab</p>
                </div>
                <div className="rounded-2xl shadow-sm border border-amber-100 p-6 bg-gradient-to-br from-amber-50 via-amber-50/60 to-white">
                  <div className="flex items-center justify-between">
                    <p className="text-amber-700 text-[11px] font-bold uppercase tracking-wider">Pending review</p>
                    <FlaskConical className="h-4 w-4 text-amber-600" />
                  </div>
                  <h4 className="text-3xl font-bold text-amber-800 mt-2 tabular-nums">{formatNumber(pendingTests.length)}</h4>
                  <p className="text-amber-600/80 text-xs mt-2">Requires attention</p>
                </div>
              </div>
            </div>
          </div>
        );

  case "New Registration":
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Intake</p>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">New patient registration</h2>
        <p className="text-slate-500 text-sm mt-1.5">Register a new patient for laboratory tests and automate billing records.</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        <form className="space-y-7" onSubmit={handlePatientRegistrationSubmit}>
          
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#004d26] text-amber-300 text-[11px] font-bold">1</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Patient information</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Full name</label>
              <Input 
                placeholder="Enter patient's full name" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contact number</label>
              <Input 
                placeholder="+92 300 1234567" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regContact}
                onChange={(e) => setRegContact(e.target.value)}
                required 
              />
            </div>
            {uniqueMatchingPatients.length > 0 && (
              <div className="md:col-span-2 p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Matching patient profile(s) found ({uniqueMatchingPatients.length})
                  </h4>
                  <p className="text-[10px] text-slate-500">Click a profile to auto-fill details</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uniqueMatchingPatients.map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => {
                        setRegName(patient.patient || "");
                        setRegAge(patient.age || "");
                        setRegGender(patient.gender || "male");
                        if (patient.refDoctor) setRegRefDoctor(patient.refDoctor);
                        if (patient.specimen) setRegSpecimen(patient.specimen);
                        toast.success(`Profile loaded for ${patient.patient}`);
                      }}
                      className="flex flex-col text-left p-3 rounded-lg bg-white border border-emerald-100 hover:border-emerald-300 hover:shadow-xs transition-all duration-200 group"
                    >
                      <span className="font-bold text-slate-800 text-sm group-hover:text-emerald-700 transition-colors">
                        {patient.patient}
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        {patient.gender ? patient.gender.toUpperCase() : "N/A"} | {patient.age || "N/A"}
                      </span>
                      {(patient.refDoctor || patient.specimen) && (
                        <span className="text-[10px] text-slate-400 mt-1">
                          {patient.refDoctor && `Doctor: ${patient.refDoctor}`}
                          {patient.refDoctor && patient.specimen && " | "}
                          {patient.specimen && `Specimen: ${patient.specimen}`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Age / DoB</label>
              <Input 
                placeholder="e.g. 45 Years" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regAge}
                onChange={(e) => setRegAge(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
              <Select value={regGender} onValueChange={(val) => setRegGender(val)}>
                <SelectTrigger className="border-slate-300 rounded-lg text-black">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent className="border-slate-300 text-black mt-5">
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Reference doctor</label>
              <Input 
                placeholder="e.g. Dr. Muhammad Ali or Self" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regRefDoctor}
                onChange={(e) => setRegRefDoctor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Registration date & time</label>
              <Input 
                type="datetime-local"
                className="border-slate-300 rounded-lg text-slate-800 focus-visible:ring-emerald-200" 
                value={regDateTime}
                onChange={(e) => setRegDateTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 pt-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#004d26] text-amber-300 text-[11px] font-bold">2</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Clinical parameters</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select report templates</label>
              <button
                type="button"
                onClick={() => setIsRegTemplateDropdownOpen(!isRegTemplateDropdownOpen)}
                className="flex h-11 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-black shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-100"
              >
                <span className="truncate">
                  {selectedRegTemplates.length > 0
                    ? `${selectedRegTemplates.length} selected`
                    : "Choose report template(s)…"}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </button>

              {isRegTemplateDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsRegTemplateDropdownOpen(false)} />
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in duration-100">
                    <div className="p-1 border-b mb-2">
                      <Input
                        placeholder="Search templates…"
                        value={regTemplateSearch}
                        onChange={(e) => setRegTemplateSearch(e.target.value)}
                        className="h-8 text-xs bg-slate-50 text-black border-slate-300 rounded-md"
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
                <label className="block text-sm font-semibold text-slate-700">Examination required (editable)</label>
                {selectedRegTemplates.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearSelectedRegTemplates}
                    className="text-xs text-red-600 hover:underline font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <Input 
                placeholder="e.g. CBC, ESR, Blood Sugar" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regTests}
                onChange={(e) => setRegTests(e.target.value)}
                required 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Specimen name / type</label>
              <Input 
                placeholder="e.g. Serum, Whole Blood, Urine" 
                className="border-slate-300 rounded-lg focus-visible:ring-emerald-200" 
                value={regSpecimen}
                onChange={(e) => setRegSpecimen(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Updated Section 3 with Discount Functionality */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3 pt-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#004d26] text-amber-300 text-[11px] font-bold">3</span>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Billing & finance allocation</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Total bill (PKR)</label>
              <Input 
                type="number" 
                placeholder="Total Bill Amount" 
                className="border-slate-300 rounded-lg bg-white font-semibold text-slate-800 focus-visible:ring-emerald-200" 
                value={regTotalBill}
                onChange={(e) => setRegTotalBill(e.target.value)}
                required 
              />
            </div>
            
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Discount type</label>
              <Select value={regDiscountType} onValueChange={(val) => setRegDiscountType(val)}>
                <SelectTrigger className="border-slate-300 rounded-lg bg-white text-black">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="border-slate-300 text-black mt-2">
                  <SelectItem value="flat">Manual / Flat Amount</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                Discount value {regDiscountType === "percentage" ? "(%)" : "(PKR)"}
              </label>
              <Input 
                type="number" 
                placeholder={regDiscountType === "percentage" ? "e.g. 10%" : "e.g. 500"} 
                className="border-slate-300 rounded-lg bg-white font-semibold text-slate-800 focus-visible:ring-emerald-200" 
                value={regDiscountValue}
                onChange={(e) => setRegDiscountValue(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Advance received (PKR)</label>
              <Input 
                type="number" 
                placeholder="Amount Deposited" 
                className="border-slate-300 rounded-lg bg-white font-semibold text-emerald-800 focus-visible:ring-emerald-200" 
                value={regAdvancePaid}
                onChange={(e) => setRegAdvancePaid(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Pending balance (PKR)</label>
              <Input 
                type="text" 
                className="border-slate-300 rounded-lg bg-slate-100 font-bold text-red-700 cursor-not-allowed" 
                value={`PKR ${regPendingBalance.toLocaleString()}`}
                readOnly
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg font-semibold shadow-sm">Register patient</Button>
            <Button type="button" variant="outline" onClick={() => setActiveTab("Overview")} className="border-slate-300 rounded-lg">Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );

      case "Patient Records":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Directory</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Patient records</h2>
                <p className="text-slate-500 text-sm mt-1.5">Full clinical and billing detail for every registered patient — examination, reference doctor, specimen, and fees.</p>
              </div>
              <Button onClick={() => setActiveTab("New Registration")} className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg shadow-sm font-semibold">
                <Plus className="w-4 h-4 mr-2" />
                New Patient
              </Button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={recordsSearch}
                  onChange={(e) => setRecordsSearch(e.target.value)}
                  placeholder="Search by patient, lab ID, doctor, specimen, or test…"
                  className="h-10 rounded-lg border-slate-300 pl-9 pr-9 text-slate-800 focus-visible:ring-emerald-200"
                />
                {recordsSearch && (
                  <button
                    type="button"
                    onClick={() => setRecordsSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Clear records search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={recordsStatusFilter} onValueChange={(val) => setRecordsStatusFilter(val)}>
                <SelectTrigger className="w-full lg:w-48 border-slate-300 rounded-lg text-black shrink-0">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent className="border-slate-300 text-black">
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 shrink-0 lg:pl-2">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                {recordsFilteredPatients.length} of {testQueueData.length} patients
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[1200px]">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">Lab ID</th>
                      <th className="px-5 py-3.5">Patient</th>
                      <th className="px-5 py-3.5">Contact</th>
                      <th className="px-5 py-3.5">Reference doctor</th>
                      <th className="px-5 py-3.5">Specimen</th>
                      <th className="px-5 py-3.5">Examination / tests</th>
                      <th className="px-5 py-3.5 text-right">Test fee</th>
                      <th className="px-5 py-3.5 text-right">Advance paid</th>
                      <th className="px-5 py-3.5 text-right">Pending</th>
                      <th className="px-5 py-3.5">Registered</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recordsFilteredPatients.map((row, i) => (
                      <tr key={row.id ? `${row.id}-${i}` : i} className="hover:bg-slate-50/70 transition-colors align-top">
                        <td className="px-5 py-4 font-semibold text-slate-700 font-mono text-xs whitespace-nowrap">{row.id}</td>
                        <td className="px-5 py-4">
                          <p className="text-slate-800 font-semibold">{row.patient}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{row.age || "N/A"} · {row.gender || "N/A"}</p>
                        </td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{row.contact || "N/A"}</td>
                        <td className="px-5 py-4 text-slate-600">{row.refDoctor || "Self"}</td>
                        <td className="px-5 py-4 text-slate-600 whitespace-nowrap">{row.specimen || "N/A"}</td>
                        <td className="px-5 py-4 text-slate-600 max-w-xs">{row.tests}</td>
                        <td className="px-5 py-4 text-right font-bold text-slate-800 tabular-nums whitespace-nowrap">
                          PKR {(row.totalBill || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                          PKR {(row.advancePaid || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-red-600 tabular-nums whitespace-nowrap">
                          PKR {(row.pendingBalance || 0).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-slate-500 whitespace-nowrap">{row.registeredAt || "N/A"}</td>
                        <td className="px-5 py-4">{getStatusBadge(row.status)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <Button
                              variant="ghost"
                              onClick={() => handleOpenReportEditor(row)}
                              className="text-[#004d26] text-xs font-semibold hover:text-[#00341a] hover:bg-emerald-50 rounded-lg h-8 px-2.5 whitespace-nowrap"
                            >
                              {row.action || "View"}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeletePatient(row.id)}
                              disabled={deletingPatientId === row.id}
                              className="text-red-600 text-xs font-semibold hover:text-red-700 hover:bg-red-50 rounded-lg h-8 px-2.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!recordsFilteredPatients.length && (
                      <tr>
                        <td colSpan={12} className="px-6 py-12 text-center text-sm text-slate-400">
                          {testQueueData.length
                            ? "No patient records match your search or filter."
                            : "No patients registered yet — new registrations will appear here with full detail."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Test Queue":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Workflow</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Test queue management</h2>
                <p className="text-slate-500 text-sm mt-1.5">Manage and process pending laboratory tests.</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Lab ID</th>
                      <th className="px-6 py-3.5">Patient name</th>
                      <th className="px-6 py-3.5">Tests required</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Priority</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testQueueData.map((row, i) => (
                      <tr key={row.id ? `${row.id}-${i}` : i} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700 font-mono text-xs">{row.id}</td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{row.patient}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{row.tests}</td>
                  <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                        <td className="px-6 py-4"><Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 rounded-full ring-1 ring-inset ring-orange-200 font-medium">Normal</Badge></td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1 justify-end">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleOpenReportEditor(row)}
                              className="text-[#004d26] text-xs font-semibold hover:text-[#00341a] hover:bg-emerald-50 rounded-lg h-8 px-2.5"
                            >
                              {row.action}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeletePatient(row.id)}
                              disabled={deletingPatientId === row.id}
                              className="text-red-600 text-xs font-semibold hover:text-red-700 hover:bg-red-50 rounded-lg h-8 px-2.5"
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              {deletingPatientId === row.id ? "Deleting" : "Delete"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!testQueueData.length && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">The queue is empty — new registrations will appear here.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      // Result Entry Desk removed from dashboard as requested.
      // (Keeping router stable; any accidental navigation falls back to default.)

      case "Revenue":
      case "Finance":
        return (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Accounts</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Finance & revenue</h2>
                <p className="text-slate-500 text-sm mt-1.5">Track daily revenue, advance collections, and outstanding patient obligations.</p>
              </div>
            </div>

            {/* Finance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full w-1 bg-[#004d26]" />
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Cumulative received revenue</p>
                <h3 className="text-3xl font-bold text-[#004d26] mt-2 tabular-nums">PKR {(totalAdvancePayments).toLocaleString()}</h3>
                <p className="text-emerald-600 text-xs mt-3 font-semibold">Live, system audited</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full w-1 bg-amber-400" />
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Advance secure holdings</p>
                <h3 className="text-3xl font-bold text-slate-900 mt-2 tabular-nums">PKR {totalAdvancePayments.toLocaleString()}</h3>
                <p className="text-slate-500 text-xs mt-3 font-semibold">{advancePayments.length} active secure records</p>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full w-1 bg-red-500" />
                <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Pending accounts receivable</p>
                <h3 className="text-3xl font-bold text-red-600 mt-2 tabular-nums">PKR {totalPendingPayments.toLocaleString()}</h3>
                <p className="text-orange-600 text-xs mt-3 font-semibold">{pendingPayments.length} pending collections</p>
              </div>
            </div>

            {/* Advance Payments Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-900 text-lg">Advance patient deposits (including registrations)</h3>
                <Button 
                  onClick={() => setShowAdvancePaymentForm(!showAdvancePaymentForm)}
                  className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] text-xs rounded-lg font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record advance deposit
                </Button>
              </div>
              
              {showAdvancePaymentForm && (
                <div className="p-6 border-b border-slate-100 bg-emerald-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Patient name</label>
                      <Input 
                        placeholder="Patient Full Name" 
                        value={newAdvancePayment.patientName}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, patientName: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Lab case reference ID</label>
                      <Input 
                        placeholder="e.g. #01/05" 
                        value={newAdvancePayment.patientId}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, patientId: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Deposit value (PKR)</label>
                      <Input 
                        type="number" 
                        placeholder="Deposit Amount" 
                        value={newAdvancePayment.amount}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, amount: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setShowAdvancePaymentForm(false)} variant="outline" className="border-slate-300 text-xs rounded-lg">Cancel</Button>
                    <Button onClick={handleAddAdvancePayment} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs rounded-lg font-semibold">Save deposit record</Button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Receipt ID</th>
                      <th className="px-6 py-3.5">Patient name</th>
                      <th className="px-6 py-3.5">Lab case ID</th>
                      <th className="px-6 py-3.5">Amount</th>
                      <th className="px-6 py-3.5">Date logged</th>
                      <th className="px-6 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {advancePayments.map((payment, index) => (
                      <tr key={`${payment.id}-${payment.patientId}-${payment.date}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700 font-mono text-xs">{payment.id}</td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{payment.patientName}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{payment.patientId}</td>
                        <td className="px-6 py-4 font-bold text-emerald-700 tabular-nums">PKR {payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.date}</td>
                        <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                      </tr>
                    ))}
                    {!advancePayments.length && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400">No advance deposits recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Payments Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-900 text-lg">Outstanding receivables ledger (remaining balances)</h3>
                <Button 
                  onClick={() => setShowPendingPaymentForm(!showPendingPaymentForm)}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-semibold shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log pending invoice
                </Button>
              </div>
              
              {showPendingPaymentForm && (
                <div className="p-6 border-b border-slate-100 bg-orange-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Debtor patient name</label>
                      <Input 
                        placeholder="Patient Full Name" 
                        value={newPendingPayment.patientName}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, patientName: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Case target ID</label>
                      <Input 
                        placeholder="e.g. #01/06" 
                        value={newPendingPayment.patientId}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, patientId: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Outstanding balance (PKR)</label>
                      <Input 
                        type="number" 
                        placeholder="Balance Owed" 
                        value={newPendingPayment.amount}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, amount: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Settlement deadline</label>
                      <Input 
                        type="date" 
                        value={newPendingPayment.dueDate}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, dueDate: e.target.value})}
                        className="bg-white border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setShowPendingPaymentForm(false)} variant="outline" className="border-slate-300 text-xs rounded-lg">Cancel</Button>
                    <Button onClick={handleAddPendingPayment} className="bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-semibold">Commit invoice</Button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3.5">Invoice ID</th>
                      <th className="px-6 py-3.5">Patient name</th>
                      <th className="px-6 py-3.5">Lab case ID</th>
                      <th className="px-6 py-3.5">Balance owed</th>
                      <th className="px-6 py-3.5">Due date</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingPayments.map((payment, index) => (
                      <tr key={`${payment.id}-${payment.patientId}-${payment.dueDate}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700 font-mono text-xs">{payment.id}</td>
                        <td className="px-6 py-4 text-slate-700 font-medium">{payment.patientName}</td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">{payment.patientId}</td>
                        <td className="px-6 py-4 font-bold text-red-600 tabular-nums">PKR {payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.dueDate}</td>
                        <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            onClick={() => handleMarkAsPaid(payment.id, payment.amount, payment.patientName)}
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 h-7 rounded-lg font-semibold"
                          >
                            Mark collected
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!pendingPayments.length && (
                      <tr>
                        <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400">No outstanding balances — all clear.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Reports":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700/70">Archives</p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mt-1">Patient diagnostic archives</h2>
                <p className="text-slate-500 text-sm mt-1.5">Review, authorize, and compile structured laboratory clinical sheets.</p>
              </div>
              <Button 
                onClick={() => setActiveReportPatientData({
                  source: "admin",
                  tests: "Laboratory Report"
                })}
                className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Generate report
              </Button>
            </div>

            {/* Main Interactive Reports Table Grid */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 font-bold text-slate-800 text-sm flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-[#004d26]" />
                Active patient medical records
              </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase font-bold tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-6 py-3.5">Report #</th>
                <th className="px-6 py-3.5">Patient name</th>
                <th className="px-6 py-3.5">Generated</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                      {reportsList.map((rep, index) => (
                <tr key={rep.reportNumber || rep.id || `report-${index}`} className="hover:bg-slate-50/70 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700 font-mono text-xs">{rep.reportNumber}</td>
                  <td className="px-6 py-4 text-slate-700 font-medium">{rep.patientName}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{new Date(rep.createdAt || rep.generatedAt || rep.created_at || Date.now()).toLocaleString()}</td>
                  <td className="px-6 py-4">{getStatusBadge(rep.status || "Completed")}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-1">
                      <Button
                        variant="ghost"
                        onClick={() => setActiveReportPatientData({
                          source: "report",
                          reportNumber: rep.reportNumber,
                          patientId: rep.patientId,
                          patientName: rep.patientName
                        })}
                        className="inline-flex items-center text-[#004d26] hover:text-[#00341a] hover:bg-emerald-50 text-xs font-semibold h-8 px-2.5 rounded-lg"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View
                      </Button>

                      {/* New Delete Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReport(rep.reportNumber || rep.id)}
                        disabled={deletingReportNumber === (rep.reportNumber || rep.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold h-8 px-2.5 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!reportsList.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">No saved reports yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
            </div>

            {/* Dynamic Modal Interface Sheet for generating medical document records */}
            {selectedReportPatient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-[#004d26] text-white px-6 py-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-amber-300 text-base">Automated Report Engine</h3>
                      <p className="text-xs text-emerald-100/80 mt-0.5 font-mono">Case reference: {selectedReportPatient.id}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setSelectedReportPatient(null)} 
                      className="text-white hover:bg-emerald-800 h-8 w-8 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <form className="p-6 space-y-5" onSubmit={handleCompileAndPrintReport}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Patient</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedReportPatient.patient}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Assigned assays</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedReportPatient.tests}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical findings</label>
                      <textarea
                        value={reportFindings}
                        onChange={(e) => setReportFindings(e.target.value)}
                        className="min-h-32 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#004d26] focus:ring-2 focus:ring-emerald-100"
                        placeholder="Enter summarized findings, remarks, or report notes"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setSelectedReportPatient(null)} className="border-slate-300 rounded-lg">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isReportSaving} className="bg-[#004d26] text-amber-300 hover:bg-[#00341a] rounded-lg font-semibold">
                        <Printer className="w-4 h-4 mr-2" />
                        {isReportSaving ? "Saving…" : "Finalize report"}
                      </Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <div className="p-8">Section construction error. Tap routing paths to reset safely.</div>;
    }
    
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {isCustomizerOpen && (
        <DashboardCustomizer
          open={isCustomizerOpen}
          onClose={() => setIsCustomizerOpen(false)}
          branding={branding}
          onSave={handleBrandingSave}
          menuKey="dashboardMenuOrder"
          menuItems={baseMenuItems}
        />
      )}

      {/* SIDEBAR - DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 text-white z-30 transition-all duration-300" style={{ backgroundColor: branding.primaryColor }}>
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/10">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            <Image
              src={branding.logoUrl}
              alt={`${branding.labName} logo`}
              width={44}
              height={44}
              className="h-full w-full object-contain p-1"
              unoptimized
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-sm tracking-wide uppercase truncate" style={{ color: branding.accentColor }}>{branding.labName}</h1>
            <p className="text-[10px] text-emerald-100/70 font-semibold tracking-widest uppercase truncate">{branding.tagline}</p>
          </div>
        </div>
        <nav className="flex-1 px-3.5 py-5 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const NavIcon = NAV_ICONS[item.name] || ListChecks;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  setActiveReportPatientData(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                  isActive
                    ? "shadow-sm font-bold"
                    : "text-emerald-100/80 hover:bg-white/10 hover:text-white"
                }`}
                style={isActive ? { backgroundColor: branding.accentColor, color: branding.primaryColor } : undefined}
              >
                <NavIcon className="h-4 w-4 shrink-0" />
                {item.name}
              </button>
            );
          })}
        </nav>
        <div className="px-3.5 pb-2">
          <button
            type="button"
            onClick={() => setIsCustomizerOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-emerald-100/80 hover:bg-white/10 hover:text-white transition-all"
          >
            <Settings className="h-4 w-4 shrink-0" />
            Edit dashboard
          </button>
        </div>
        <div className="p-3.5 pt-3 border-t border-white/10">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-black/15">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0" style={{ backgroundColor: branding.accentColor, color: branding.primaryColor }}>AD</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">System Admin</p>
              <p className="text-[10px] text-emerald-100/60 truncate">{branding.labName || "Lab Desk"}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* SIDEBAR - MOBILE */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden animate-in fade-in duration-200">
          <aside className="w-64 text-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200" style={{ backgroundColor: branding.primaryColor }}>
            <div className="px-5 py-5 border-b border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src={branding.logoUrl}
                    alt={`${branding.labName} logo`}
                    width={36}
                    height={36}
                    className="h-full w-full object-contain p-1"
                    unoptimized
                  />
                </div>
                <span className="font-bold truncate" style={{ color: branding.accentColor }}>{branding.labName}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsMobileSidebarOpen(false)} className="text-white hover:bg-white/10 rounded-lg shrink-0">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 px-3.5 py-5 space-y-1 overflow-y-auto">
              {menuItems.map((item) => {
                const NavIcon = NAV_ICONS[item.name] || ListChecks;
                const isActive = activeTab === item.name;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setActiveTab(item.name);
                      setIsMobileSidebarOpen(false);
                      setActiveReportPatientData(null);
                    }}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm ${
                      isActive ? "font-bold" : "text-emerald-100/80 hover:bg-white/10"
                    }`}
                    style={isActive ? { backgroundColor: branding.accentColor, color: branding.primaryColor } : undefined}
                  >
                    <NavIcon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
            <div className="px-3.5 pb-4">
              <button
                type="button"
                onClick={() => {
                  setIsCustomizerOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm text-emerald-100/80 hover:bg-white/10"
              >
                <Settings className="h-4 w-4 shrink-0" />
                Edit dashboard
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN SCREEN CANVAS CONTAINER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-sm flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden text-slate-600 rounded-lg">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full text-xs text-emerald-700 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              System online
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-slate-700">{branding.address}</p>
              <p className="text-[10px] text-slate-400 font-semibold">Cell: {branding.phone}</p>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Body Content Wrapper */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {activeReportPatientData ? (
              <LabReportTemplate
                patientData={activeReportPatientData}
                onClose={() => setActiveReportPatientData(null)}
                onReportSaved={async () => {
                  try {
                    const url = currentLabId ? `/api/patients?labId=${encodeURIComponent(currentLabId)}` : "/api/patients";
                    const res = await fetch(url);
                    const data = await res.json();
                    if (res.ok) {
                      if (data.patients) setTestQueueData(data.patients);
                    }
                    const reportsRes = await fetch(`/api/reports?labId=${encodeURIComponent(currentLabId)}`);
                    const reportsData = await reportsRes.json();
                    if (reportsRes.ok) {
                      setReportsList(reportsData.reports || []);
                    }
                  } catch (e) {
                    console.warn("Could not reload lists", e);
                  }
                }}
              />
            ) : (
              renderContent()
            )}
          </div>
        </main>
      </div>
    </div>
  );
}