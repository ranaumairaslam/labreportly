"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Menu, Plus, Printer, Search, Settings, Trash2, X } from "lucide-react";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import { readStoredBranding, storeBranding } from "@/lib/dashboardBranding";


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

function formatNumber(value) {
  return value.toLocaleString("en-PK");
}

function formatPKR(value) {
  return value.toLocaleString("en-PK");
}

/* Desig bbn Philosophy: Clinical Elegance
   - Green (#004d26) and yellow (#FBBF24) color palette maintained
   - Soft shadows and subtle gradients for depth
   - Responsive grid layout with generous whitespace
   - Smooth transitions between sidebar sections (250ms ease-out)
   - Status indicators use color psychology (green/yellow/red)
*/

export default function Home() {
  const [activeTab, setActiveTab] = useState("Overview");
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [branding, setBranding] = useState(readStoredBranding);
  const [patientSearch, setPatientSearch] = useState("");
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

  // Derived tracking variable for instantaneous math calculations
  const regPendingBalance = Math.max(0, (parseInt(regTotalBill) || 0) - (parseInt(regAdvancePaid) || 0));

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
        if (lab?.id) {
          setCurrentLabId(lab.id);
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

    loadPatients();
    loadLabContext();
    loadStaffAccounts();
    loadReports();
  }, [currentLabId]);

  // Selected patient for interactive report generator modal
  const [selectedReportPatient, setSelectedReportPatient] = useState(null);
  const [reportFindings, setReportFindings] = useState("");
  const [isReportSaving, setIsReportSaving] = useState(false);

  // Menu items with icons
  const baseMenuItems = [
    { name: "Overview", icon: "📊" },
    { name: "New Registration", icon: "📝" },
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
      advancePaid: currentAdvancePaid,
      pendingBalance: regPendingBalance,
      registeredAt: new Date().toISOString().split('T')[0],
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

  const getStatusBadge = (status) => {
    const statusMap = {
      "Processing": { bg: "bg-yellow-100", text: "text-yellow-800" },
      "Pending": { bg: "bg-orange-100", text: "text-orange-800" },
      "Completed": { bg: "bg-green-100", text: "text-green-800" },
      "Received": { bg: "bg-green-100", text: "text-green-800" },
      "Overdue": { bg: "bg-red-100", text: "text-red-800" },
    };
    const style = statusMap[status] || { bg: "bg-gray-100", text: "text-gray-800" };
    return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${style.bg} ${style.text}`}>{status}</span>;
  };

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

  // Content Switching Router
  const renderContent = () => {
    switch (activeTab) {
      case "Overview":
        return (
          <div className="space-y-8 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">Dashboard Overview</h2>
                <p className="text-slate-500 text-sm mt-1">Welcome back, Admin Staff. Here&apos;s your lab status.</p>
              </div>
              <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <Button onClick={() => setActiveTab("New Registration")} className="flex-1 md:flex-none bg-[#004d26] text-yellow-400 hover:bg-[#00361a]">
                  <Plus className="w-4 h-4 mr-2" />
                  New Patient
                </Button>
                <Button onClick={() => setIsStaffFormOpen((prev) => !prev)} variant="outline" className="border-slate-300 text-slate-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Staff
                </Button>
              </div>
            </div>

            {isStaffFormOpen && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Create Staff Dashboard Account</h3>
                    <p className="text-sm text-slate-500">This will create a unique email and password for a new staff dashboard login tied to your lab.</p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => setIsStaffFormOpen(false)} className="text-slate-500 hover:text-slate-700">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <form onSubmit={handleCreateStaff} className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Staff Name</label>
                    <Input value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} placeholder="e.g. Ali Khan" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Email</label>
                    <Input type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} placeholder="staff@yourlab.com" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Password</label>
                    <Input type="password" value={staffForm.password} onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="Create a secure password" required />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Role</label>
                    <Input value={staffForm.role} onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} placeholder="Staff" />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <Button type="submit" disabled={isCreatingStaff} className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]">
                      {isCreatingStaff ? "Creating..." : "Create Staff Account"}
                    </Button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">Find Patient Details</h3>
                  <p className="text-slate-500 text-sm mt-1">Search by lab ID, patient name, contact, test, receipt, or invoice.</p>
                </div>
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient details..."
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

              {normalizedPatientSearch && (
                selectedPatientDetail ? (
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Matched Patient</p>
                        <h4 className="text-2xl font-bold text-slate-800 mt-1">{selectedPatientDetail.patient}</h4>
                        <p className="text-sm text-slate-600 mt-1">Lab ID: {selectedPatientDetail.id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(selectedPatientDetail.status)}
                        {searchedPatients.length > 1 && (
                          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                            {searchedPatients.length} matches
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Contact</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedPatientDetail.contact || "N/A"}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Age / Gender</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedPatientDetail.age || "N/A"} / {selectedPatientDetail.gender || "N/A"}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Registered</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedPatientDetail.registeredAt || "N/A"}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Tests</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedPatientDetail.tests}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Total Bill</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">PKR {selectedPatientPayments.totalBill.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Advance Received</p>
                        <p className="text-xl font-bold text-emerald-700 mt-1">PKR {selectedPatientPayments.advanceTotal.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg bg-white border border-slate-100 p-4">
                        <p className="text-xs font-bold uppercase text-slate-500">Pending Balance</p>
                        <p className="text-xl font-bold text-red-700 mt-1">PKR {selectedPatientPayments.pendingBalance.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-lg bg-white border border-slate-100 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-700">Advance Receipts</div>
                        <div className="divide-y divide-slate-100">
                          {selectedPatientPayments.advances.length ? selectedPatientPayments.advances.map((payment) => (
                            <div key={payment.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                              <div>
                                <p className="font-semibold text-slate-700">{payment.id}</p>
                                <p className="text-xs text-slate-500">{payment.date} - {payment.status}</p>
                              </div>
                              <p className="font-bold text-emerald-700">PKR {payment.amount.toLocaleString()}</p>
                            </div>
                          )) : (
                            <p className="px-4 py-3 text-sm text-slate-500">No advance receipt found.</p>
                          )}
                        </div>
                      </div>

                      <div className="rounded-lg bg-white border border-slate-100 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-700">Pending Invoices</div>
                        <div className="divide-y divide-slate-100">
                          {selectedPatientPayments.pendings.length ? selectedPatientPayments.pendings.map((payment) => (
                            <div key={payment.id} className="px-4 py-3 flex justify-between gap-3 text-sm">
                              <div>
                                <p className="font-semibold text-slate-700">{payment.id}</p>
                                <p className="text-xs text-slate-500">Due {payment.dueDate} - {payment.status}</p>
                              </div>
                              <p className="font-bold text-red-700">PKR {payment.amount.toLocaleString()}</p>
                            </div>
                          )) : (
                            <p className="px-4 py-3 text-sm text-slate-500">No pending invoice found.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                    No patient found for &quot;{patientSearch}&quot;.
                  </div>
                )
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">Lab Staff Accounts</h3>
                  <p className="text-sm text-slate-500">Accounts created here can use the staff dashboard login.</p>
                </div>
              </div>
              <div className="space-y-3">
                {labStaff.length ? labStaff.map((staff) => (
                  <div key={staff.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-800">{staff.name}</p>
                        <p className="text-sm text-slate-500">{staff.email}</p>
                      </div>
                      <Badge className="bg-[#004d26] text-yellow-400 hover:bg-[#004d26]">{staff.role || "Staff"}</Badge>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-slate-500">No staff accounts created yet.</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 group">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{stat.label}</p>
                      <h3 className="text-3xl font-bold text-slate-800 mt-2">{stat.value}</h3>
                    </div>
                    <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
                  </div>
                  <p className={`text-xs mt-3 font-semibold ${
                    stat.type === "positive" ? "text-green-600" : 
                    stat.type === "warning" ? "text-yellow-600" : 
                    stat.type === "info" ? "text-blue-600" : "text-slate-600"
                  }`}>
                    {stat.change}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <h3 className="font-bold text-slate-700 text-lg">Recent Test Queue</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">Lab ID</th>
                        <th className="px-6 py-4">Patient</th>
                        <th className="px-6 py-4">Tests</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {testQueueData.slice(-4).reverse().map((row, i) => (
                        <tr key={row.id ? `${row.id}-${i}` : i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-700">{row.id}</td>
                          <td className="px-6 py-4 text-slate-600">{row.patient}</td>
                          <td className="px-6 py-4 text-slate-600 text-xs">{row.tests}</td>
                          <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                          <td className="px-6 py-4 flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              onClick={() => handleRowReportAction(row)}
                              className="text-blue-600 text-xs font-semibold hover:text-blue-800"
                            >
                              {row.action}
                            </Button>
                            <Button
                              variant="ghost"
                              onClick={() => handleDeletePatient(row.id)}
                              disabled={deletingPatientId === row.id}
                              className="text-red-600 text-xs font-semibold hover:text-red-800"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              {deletingPatientId === row.id ? "Deleting" : "Delete"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-linear-to-br from-green-50 to-white rounded-xl shadow-sm border border-green-100 p-6">
                  <p className="text-green-600 text-xs font-semibold uppercase">Tests Completed</p>
                  <h4 className="text-3xl font-bold text-green-700 mt-2"></h4>
                  <p className="text-green-600 text-xs mt-2">This month</p>
                </div>
                <div className="bg-linear-to-br from-yellow-50 to-white rounded-xl shadow-sm border border-yellow-100 p-6">
                  <p className="text-yellow-600 text-xs font-semibold uppercase">Pending Review</p>
                  <h4 className="text-3xl font-bold text-yellow-700 mt-2"></h4>
                  <p className="text-yellow-600 text-xs mt-2">Requires attention</p>
                </div>
              </div>
            </div>
          </div>
        );

      case "New Registration":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">New Patient Registration</h2>
              <p className="text-slate-500 text-sm mt-1">Register a new patient for laboratory tests and automate billing records.</p>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-slate-100 p-8">
              <form className="space-y-6" onSubmit={handlePatientRegistrationSubmit}>
                
                <h3 className="text-sm font-bold text-[#004d26] uppercase tracking-wider border-b pb-2">1. Patient Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                    <Input 
                      placeholder="Enter patient's full name" 
                      className="border-slate-300" 
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Contact Number</label>
                    <Input 
                      placeholder="+92 300 1234567" 
                      className="border-slate-300" 
                      value={regContact}
                      onChange={(e) => setRegContact(e.target.value)}
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Age / DoB</label>
                    <Input 
                      placeholder="e.g. 45 Years" 
                      className="border-slate-300" 
                      value={regAge}
                      onChange={(e) => setRegAge(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Gender</label>
                    <Select value={regGender} onValueChange={(val) => setRegGender(val)}>
                      <SelectTrigger className="border-slate-300 text-black">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-300 text-black mt-5">
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#004d26] uppercase tracking-wider border-b pb-2 pt-2">2. Clinical Parameters</h3>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Examination Required</label>
                  <Input 
                    placeholder="e.g. CBC, ESR, Blood Sugar" 
                    className="border-slate-300" 
                    value={regTests}
                    onChange={(e) => setRegTests(e.target.value)}
                    required 
                  />
                </div>

                <h3 className="text-sm font-bold text-[#004d26] uppercase tracking-wider border-b pb-2 pt-2">3. Integrated Billing & Finance Allocation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Total Test Bill (PKR)</label>
                    <Input 
                      type="number" 
                      placeholder="Total Bill Amount" 
                      className="border-slate-300 bg-white font-semibold text-slate-800" 
                      value={regTotalBill}
                      onChange={(e) => setRegTotalBill(e.target.value)}
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Advance Received (PKR)</label>
                    <Input 
                      type="number" 
                      placeholder="Amount Deposited Now" 
                      className="border-slate-300 bg-white font-semibold text-emerald-800" 
                      value={regAdvancePaid}
                      onChange={(e) => setRegAdvancePaid(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Pending Balance (PKR)</label>
                    <Input 
                      type="text" 
                      className="border-slate-300 bg-slate-100 font-bold text-red-700 cursor-not-allowed" 
                      value={`PKR ${regPendingBalance.toLocaleString()}`}
                      readOnly
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]">Register Patient</Button>
                  <Button type="button" variant="outline" onClick={() => setActiveTab("Overview")} className="border-slate-300">Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        );

      case "Test Queue":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-slate-800">Test Queue Management</h2>
                <p className="text-slate-500 text-sm mt-1">Manage and process pending laboratory tests.</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Lab ID</th>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Tests Required</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {testQueueData.map((row, i) => (
                      <tr key={row.id ? `${row.id}-${i}` : i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700">{row.id}</td>
                        <td className="px-6 py-4 text-slate-600">{row.patient}</td>
                        <td className="px-6 py-4 text-slate-600 text-xs">{row.tests}</td>
                        <td className="px-6 py-4">{getStatusBadge(row.status)}</td>
                        <td className="px-6 py-4"><Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Normal</Badge></td>
                        <td className="px-6 py-4 flex items-center gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            onClick={() => handleRowReportAction(row)}
                            className="text-blue-600 text-xs font-semibold hover:text-blue-800"
                          >
                            {row.action}
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => handleDeletePatient(row.id)}
                            disabled={deletingPatientId === row.id}
                            className="text-red-600 text-xs font-semibold hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {deletingPatientId === row.id ? "Deleting" : "Delete"}
                          </Button>
                        </td>
                      </tr>
                    ))}
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
                <h2 className="text-3xl font-bold text-slate-800">Finance & Revenue Matrices</h2>
                <p className="text-slate-500 text-sm mt-1">Track daily revenue, advance collections, and outstanding patient obligations.</p>
              </div>
            </div>

            {/* Finance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border-l-4 border-l-[#004d26] shadow-sm">
                <p className="text-slate-500 text-xs font-semibold uppercase">Cumulative Received Revenue</p>
                <h3 className="text-3xl font-bold text-[#004d26] mt-2">PKR {(totalAdvancePayments).toLocaleString()}</h3>
                <p className="text-green-600 text-xs mt-3 font-semibold">Live System Audited</p>
              </div>
              <div className="bg-white p-6 rounded-xl border-l-4 border-l-yellow-500 shadow-sm">
                <p className="text-slate-500 text-xs font-semibold uppercase">Advance Secure Holdings</p>
                <h3 className="text-3xl font-bold text-slate-800 mt-2">PKR {totalAdvancePayments.toLocaleString()}</h3>
                <p className="text-slate-500 text-xs mt-3 font-semibold">{advancePayments.length} Active secure records</p>
              </div>
              <div className="bg-white p-6 rounded-xl border-l-4 border-l-red-500 shadow-sm">
                <p className="text-slate-500 text-xs font-semibold uppercase">Pending Accounts Receivables</p>
                <h3 className="text-3xl font-bold text-red-600 mt-2">PKR {totalPendingPayments.toLocaleString()}</h3>
                <p className="text-orange-600 text-xs mt-3 font-semibold">{pendingPayments.length} Pending Collections</p>
              </div>
            </div>

            {/* Advance Payments Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-700 text-lg">Advance Patient Deposits (Including Registrations)</h3>
                <Button 
                  onClick={() => setShowAdvancePaymentForm(!showAdvancePaymentForm)}
                  className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a] text-xs"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Record Advance Deposit
                </Button>
              </div>
              
              {showAdvancePaymentForm && (
                <div className="p-6 border-b border-slate-100 bg-emerald-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Patient Name</label>
                      <Input 
                        placeholder="Patient Full Name" 
                        value={newAdvancePayment.patientName}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, patientName: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Lab Case Reference ID</label>
                      <Input 
                        placeholder="e.g. #01/05" 
                        value={newAdvancePayment.patientId}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, patientId: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Deposit Value (PKR)</label>
                      <Input 
                        type="number" 
                        placeholder="Deposit Amount" 
                        value={newAdvancePayment.amount}
                        onChange={(e) => setNewAdvancePayment({...newAdvancePayment, amount: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setShowAdvancePaymentForm(false)} variant="outline" className="border-slate-300 text-xs">Cancel</Button>
                    <Button onClick={handleAddAdvancePayment} className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs">Save Deposit Record</Button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Receipt ID</th>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Lab Case ID</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Date Logged</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {advancePayments.map((payment, index) => (
                      <tr key={`${payment.id}-${payment.patientId}-${payment.date}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700">{payment.id}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{payment.patientName}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.patientId}</td>
                        <td className="px-6 py-4 font-bold text-emerald-800">PKR {payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.date}</td>
                        <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pending Payments Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="font-bold text-slate-700 text-lg">Outstanding Receivables Ledger (Remaining Balances)</h3>
                <Button 
                  onClick={() => setShowPendingPaymentForm(!showPendingPaymentForm)}
                  className="bg-red-700 hover:bg-red-800 text-white text-xs"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Log Pending Invoice
                </Button>
              </div>
              
              {showPendingPaymentForm && (
                <div className="p-6 border-b border-slate-100 bg-orange-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Debtor Patient Name</label>
                      <Input 
                        placeholder="Patient Full Name" 
                        value={newPendingPayment.patientName}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, patientName: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Case Target ID</label>
                      <Input 
                        placeholder="e.g. #01/06" 
                        value={newPendingPayment.patientId}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, patientId: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Outstanding Balance (PKR)</label>
                      <Input 
                        type="number" 
                        placeholder="Balance Owed" 
                        value={newPendingPayment.amount}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, amount: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Settlement Deadline</label>
                      <Input 
                        type="date" 
                        value={newPendingPayment.dueDate}
                        onChange={(e) => setNewPendingPayment({...newPendingPayment, dueDate: e.target.value})}
                        className="bg-white border-slate-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => setShowPendingPaymentForm(false)} variant="outline" className="border-slate-300 text-xs">Cancel</Button>
                    <Button onClick={handleAddPendingPayment} className="bg-red-700 hover:bg-red-800 text-white text-xs">Commit Invoice</Button>
                  </div>
                </div>
              )}
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">Invoice ID</th>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Lab Case ID</th>
                      <th className="px-6 py-4">Balance Owed</th>
                      <th className="px-6 py-4">Due Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingPayments.map((payment, index) => (
                      <tr key={`${payment.id}-${payment.patientId}-${payment.dueDate}-${index}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-700">{payment.id}</td>
                        <td className="px-6 py-4 text-slate-600 font-medium">{payment.patientName}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.patientId}</td>
                        <td className="px-6 py-4 font-bold text-red-700">PKR {payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-slate-500">{payment.dueDate}</td>
                        <td className="px-6 py-4">{getStatusBadge(payment.status)}</td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            onClick={() => handleMarkAsPaid(payment.id, payment.amount, payment.patientName)}
                            size="sm" 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 h-7"
                          >
                            Mark Collected
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Reports":
        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <h2 className="text-3xl font-bold text-slate-800">Patient Diagnostic Archives</h2>
              <p className="text-slate-500 text-sm mt-1">Review, authorize, and compile structured laboratory clinical sheets.</p>
               <div className="flex gap-3 w-full md:w-auto justify-end mt-4">
                <Button asChild className="flex-1 md:flex-none bg-[#004d26] text-yellow-400 hover:bg-[#00361a]">
                  <Link href="/template">
                    <Plus className="w-4 h-4 mr-2" />
                    Report Generate
                  </Link>
                </Button>
              </div>
            </div>

            {/* Main Interactive Reports Table Grid */}
            <div className="bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden">
              <div className="p-5 border-b bg-slate-50/60 font-semibold text-slate-700 text-sm">
                Active Patient Medical Records
              </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Report #</th>
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4">Generated</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportsList.map((rep, index) => (
                <tr key={rep.reportNumber || rep.id || `report-${index}`} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{rep.reportNumber}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{rep.patientName}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">{new Date(rep.createdAt || rep.generatedAt || rep.created_at || Date.now()).toLocaleString()}</td>
                  <td className="px-6 py-4">{rep.status || "Completed"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <Link
                        href={`/template?source=report&reportNumber=${encodeURIComponent(rep.reportNumber)}`}
                        className="inline-flex items-center text-[#004d26] hover:text-[#00361a] text-xs font-semibold"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Report
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!reportsList.length && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-500">No saved reports yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
            </div>

            {/* Dynamic Modal Interface Sheet for generating medical document records */}
            {selectedReportPatient && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">

                
                <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="bg-[#004d26] text-white px-6 py-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-yellow-400 text-base">Al-Jannat Automated Report Engine</h3>
                      <p className="text-xs text-emerald-100/80 mt-0.5">Compiling values for Case reference: {selectedReportPatient.id}</p>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setSelectedReportPatient(null)} 
                      className="text-white hover:bg-emerald-800 h-8 w-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <form className="p-6 space-y-5" onSubmit={handleCompileAndPrintReport}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Patient</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedReportPatient.patient}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase text-slate-500">Assigned Assays</p>
                        <p className="font-semibold text-slate-800 mt-1">{selectedReportPatient.tests}</p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Clinical Findings</label>
                      <textarea
                        value={reportFindings}
                        onChange={(e) => setReportFindings(e.target.value)}
                        className="min-h-32 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#004d26] focus:ring-2 focus:ring-emerald-100"
                        placeholder="Enter summarized findings, remarks, or report notes"
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-3">
                      <Button type="button" variant="outline" onClick={() => setSelectedReportPatient(null)} className="border-slate-300">
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isReportSaving} className="bg-[#004d26] text-yellow-400 hover:bg-[#00361a]">
                        <Printer className="w-4 h-4 mr-2" />
                        {isReportSaving ? "Saving..." : "Finalize Report"}
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
      <aside className="hidden lg:flex flex-col w-64 text-white border-r border-emerald-900 z-30 transition-all duration-300" style={{ backgroundColor: branding.primaryColor }}>
        <div className="p-1 border-b border-emerald-900 flex items-center">
          <div className="w-22 h-22 flex  shadow-inner overflow-hidden">
            <Image
              src={branding.logoUrl}
              alt={`${branding.labName} logo`}
              width={100}
              height={100}
              className="h-full w-full object-contain p-1"
              unoptimized
            />
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wider uppercase" style={{ color: branding.accentColor }}>{branding.labName}</h1>
            <p className="text-[10px] text-emerald-100 font-semibold tracking-widest uppercase">{branding.tagline}</p>
          </div>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                activeTab === item.name
                  ? "bg-yellow-400 text-[#004d26] shadow-md font-bold scale-[1.02]"
                  : "text-emerald-100 hover:bg-emerald-800/60 hover:text-white"
              }`}
              style={activeTab === item.name ? { backgroundColor: branding.accentColor, color: branding.primaryColor } : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {item.name}
            </button>
          ))}
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
          <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-950/40">
            <div className="w-8 h-8 rounded-full bg-yellow-400 text-[#004d26] flex items-center justify-center font-bold text-xs">AD</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-white">System Admin</p>
              <p className="text-[10px] text-emerald-200 truncate">Arifwala Desk</p>
            </div>
          </div>
        </div>
      </aside>

      {/* SIDEBAR - MOBILE */}
      {isMobileSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden animate-in fade-in duration-200">
          <aside className="w-64 text-white h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200" style={{ backgroundColor: branding.primaryColor }}>
            <div className="p-6 border-b border-emerald-900 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white rounded-md flex items-center justify-center overflow-hidden">
                  <Image
                    src={branding.logoUrl}
                    alt={`${branding.labName} logo`}
                    width={36}
                    height={36}
                    className="h-full w-full object-contain p-1"
                    unoptimized
                  />
                </div>
                <span className="font-bold" style={{ color: branding.accentColor }}>{branding.labName}</span>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setIsMobileSidebarOpen(false)} className="text-white hover:bg-emerald-800">
                <X className="w-5 h-5" />
              </Button>
            </div>
            <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
              {menuItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => { setActiveTab(item.name); setIsMobileSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm ${
                    activeTab === item.name ? "bg-yellow-400 text-[#004d26] font-bold" : "text-emerald-100 hover:bg-emerald-800"
                  }`}
                  style={activeTab === item.name ? { backgroundColor: branding.accentColor, color: branding.primaryColor } : undefined}
                >
                  <span>{item.icon}</span>
                  {item.name}
                </button>
              ))}
            </nav>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setIsCustomizerOpen(true);
                  setIsMobileSidebarOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm text-emerald-100 hover:bg-emerald-800"
              >
                <Settings className="h-4 w-4" />
                Edit Dashboard
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN SCREEN CANVAS CONTAINER */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={() => setIsMobileSidebarOpen(true)} className="lg:hidden text-slate-600">
              <Menu className="w-5 h-5" />
            </Button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-xs text-slate-600 font-medium">
             
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
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}