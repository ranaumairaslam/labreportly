"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Printer, X, Plus, Trash2, LayoutDashboard, FileText, ImagePlus, Save, Settings } from "lucide-react";
import { normalizeBranding, readStoredBranding, storeBranding } from "@/lib/dashboardBranding";

const DEFAULT_REPORT_COLUMNS = [
  
  { key: "normalValue", label: "NORMAL VALUE" },
];

const REPORT_TEMPLATES = [
  {
    key: "loading",
    label: "Loading reports",
    examRequired: "Laboratory Report",
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    columns: DEFAULT_REPORT_COLUMNS,
    rows: [{ isSection: false, test: "", result: "", units: "", normalValue: "" }],
  },
];

function cloneRows(rows) {
  return rows.map((row) => ({
    ...row,
    id: row.id || createUniqueRowId(),
    result: row.result || "",
  }));
}

function groupRowsIntoTables(rows, defaultColumns) {
  const tables = [];
  let currentTable = null;

  rows.forEach((row) => {
    if (row.newTable || !currentTable) {
      if (currentTable) {
        tables.push(currentTable);
      }
      currentTable = {
        columns: row.tableColumns || defaultColumns,
        rows: [],
      };
    }
    currentTable.rows.push(row);
  });

  if (currentTable) {
    tables.push(currentTable);
  }
  return tables;
}

function getTemplateColumns(template) {
  return Array.isArray(template?.columns) && template.columns.length > 0 ? template.columns : DEFAULT_REPORT_COLUMNS;
}

function getReportTemplateByKey(templates, key) {
  return templates.find((template) => template.key === key) || templates[0] || REPORT_TEMPLATES[0];
}

function normalizeExamString(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[+]/g, " plus ")
    .replace(/[.&,_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeExam(s) {
  const normalized = normalizeExamString(s);
  if (!normalized) return [];

  // Special handling for patterns like PT.APTT.INR where dots are used as separators.
  const spaced = normalized.replace(/\b([a-z]{1,6})\s+([a-z]{1,6})\b/g, "$1 $2");

  return spaced
    .split(" ")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => t.length > 1 || ["pt", "hb", "inr", "esr"].includes(t));
}

function tokenOverlapScore(candidateTokens, examTokens) {
  if (!candidateTokens.length || !examTokens.length) return 0;
  const setA = new Set(examTokens);
  let overlap = 0;
  for (const t of candidateTokens) {
    if (setA.has(t)) overlap += 1;
  }
  // Normalize by candidate size to reduce bias toward long templates
  return overlap / candidateTokens.length;
}

function getReportTemplateFromExam(templates, examRequired) {
  const examTokens = tokenizeExam(examRequired);
  if (!examTokens.length) return templates[0] || REPORT_TEMPLATES[0];

  let best = null;
  let bestScore = -1;

  for (const template of templates) {
    const candidateStr = `${template?.examRequired || ""} ${template?.label || ""}`;
    const candidateTokens = tokenizeExam(candidateStr);
    const score = tokenOverlapScore(candidateTokens, examTokens);

    // Hard matches get boosted
    const normalizedExam = normalizeExamString(examRequired);
    const normalizedCandidate = normalizeExamString(template?.examRequired || "");

    const hardBoost =
      normalizedExam === normalizedCandidate || normalizedExam.includes(normalizedCandidate)
        ? 0.5
        : 0;

    const finalScore = score + hardBoost;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = template;
    }
  }

  return best || templates.find((template) => template.key === "custom") || templates[0] || REPORT_TEMPLATES[0];
}


function createUniqueReportId() {
  return `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function createUniqueRowId() {
  return `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function getInitialFormData(searchParams, reportTemplate) {
  const patientId = searchParams.get("patientId");
  const patientName = searchParams.get("patientName");
  const tests = searchParams.get("tests");
  const registeredAt = searchParams.get("registeredAt");

  return {
    id: patientId || createUniqueReportId(),
    date: registeredAt || "Thursday, May 14, 2026",
    name: patientName || "JAVAID",
    refBy: "Special thanks for the Doctor",
    specimen: reportTemplate.specimen,
    examRequired: tests || reportTemplate.examRequired,
    categoryTitle: reportTemplate.categoryTitle,
    findings: "",
  };
}

function TemplateCustomizer({ open, branding, onClose, onSave }) {
  const [draft, setDraft] = useState(() => normalizeBranding(branding));
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const updateDraft = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file for the report logo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateDraft("logoUrl", reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextBranding = normalizeBranding(draft);
    setIsSaving(true);
    storeBranding(nextBranding);

    try {
      if (nextBranding.labId) {
        const res = await fetch("/api/labs", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: nextBranding.labId,
            name: nextBranding.labName,
            branding: nextBranding,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Could not save template settings.");
      }

      onSave(nextBranding);
      toast.success("Template settings saved.");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not save template settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm print:hidden">
      <form onSubmit={handleSubmit} className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Report Template</h2>
            <p className="mt-1 text-xs text-slate-500">Customize report letterhead, logo, footer, colors, and signature label.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mx-auto flex h-32 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                {draft.logoUrl ? (
                  <Image src={draft.logoUrl} alt={`${draft.labName} report logo`} width={128} height={128} className="h-full w-full object-contain p-2" unoptimized />
                ) : (
                  <ImagePlus className="h-10 w-10 text-slate-300" />
                )}
              </div>
              <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100">
                <ImagePlus className="h-4 w-4" />
                Upload Logo
                <input type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">English Lab Name</label>
                <input value={draft.labName} onChange={(e) => updateDraft("labName", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">English Tagline</label>
                <input value={draft.tagline} onChange={(e) => updateDraft("tagline", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Urdu Lab Name</label>
                <input value={draft.templateUrduName} onChange={(e) => updateDraft("templateUrduName", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" dir="rtl" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Urdu Tagline</label>
                <input value={draft.templateUrduTagline} onChange={(e) => updateDraft("templateUrduTagline", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" dir="rtl" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Header Color</label>
                <input type="color" value={draft.primaryColor} onChange={(e) => updateDraft("primaryColor", e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Accent Color</label>
                <input type="color" value={draft.accentColor} onChange={(e) => updateDraft("accentColor", e.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white p-1" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Signature Label</label>
                <input value={draft.templateInchargeLabel} onChange={(e) => updateDraft("templateInchargeLabel", e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Watermark Opacity</label>
                <input type="range" min="0" max="0.2" step="0.01" value={draft.templateWatermarkOpacity} onChange={(e) => updateDraft("templateWatermarkOpacity", e.target.value)} className="h-10 w-full" />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">Footer Address Line</label>
                <textarea value={draft.templateFooter} onChange={(e) => updateDraft("templateFooter", e.target.value)} rows="3" className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-700" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-200">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-emerald-900 disabled:opacity-50">
            {isSaving ? "Saving..." : <Save className="h-4 w-4" />}
            Save Template
          </button>
        </div>
      </form>
    </div>
  );
}

function LabReportTemplateContent({ onClose, onNavigateDashboard }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [branding, setBranding] = useState(readStoredBranding);
  const [isTemplateCustomizerOpen, setIsTemplateCustomizerOpen] = useState(false);
  const [reportTemplates, setReportTemplates] = useState(REPORT_TEMPLATES);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  // Mode Selection: 'pdf' (Full letterhead) or 'print' (Pre-printed paper / Clear results)
  const [templateMode, setTemplateMode] = useState("pdf"); 
  const [selectedReportTemplate, setSelectedReportTemplate] = useState(() => getReportTemplateFromExam(REPORT_TEMPLATES, searchParams.get("tests")).key);
  const [reportColumns, setReportColumns] = useState(() => getTemplateColumns(getReportTemplateFromExam(REPORT_TEMPLATES, searchParams.get("tests"))));

  // General report details initialized with the image's exact data
  const [formData, setFormData] = useState(() => {
    const reportTemplate = getReportTemplateFromExam(REPORT_TEMPLATES, searchParams.get("tests"));
    return getInitialFormData(searchParams, reportTemplate);
  });

  // Dynamic test results are loaded from the selected report template.
  const [testResults, setTestResults] = useState(() => cloneRows(getReportTemplateByKey(REPORT_TEMPLATES, selectedReportTemplate).rows));

  useEffect(() => {
    let ignore = false;

    async function loadReportTemplates() {
      try {
        const res = await fetch("/api/report-templates");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || "Unable to load report templates.");
        }

        if (ignore || !Array.isArray(data.templates) || data.templates.length === 0) return;

        const nextTemplates = data.templates;
        const matchedTemplate = getReportTemplateFromExam(nextTemplates, searchParams.get("tests"));
        setReportTemplates(nextTemplates);
        setSelectedReportTemplate(matchedTemplate.key);
        setReportColumns(getTemplateColumns(matchedTemplate));
        setFormData((prev) => ({
          ...prev,
          specimen: matchedTemplate.specimen,
          examRequired: searchParams.get("tests") || matchedTemplate.examRequired,
          categoryTitle: matchedTemplate.categoryTitle,
        }));
        setTestResults(cloneRows(matchedTemplate.rows));
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Could not load report templates from public folder.");
      } finally {
        if (!ignore) setIsLoadingTemplates(false);
      }
    }

    loadReportTemplates();

    return () => {
      ignore = true;
    };
  }, [searchParams]);

  // If opened as a saved report viewer (source=report), load the saved report from the DB
  useEffect(() => {
    let ignore = false;
    async function loadSavedReport() {
      const source = searchParams.get("source");
      const reportNumber = searchParams.get("reportNumber") || searchParams.get("lastReportNumber");
      if (source !== "report" || !reportNumber) return;

      try {
        const res = await fetch(`/api/reports?reportNumber=${encodeURIComponent(reportNumber)}`);
        const data = await res.json();
        if (!res.ok) {
          console.warn(data.message || "Could not load saved report.");
          return;
        }

        const report = (data.reports || [])[0];
        if (!report) return;

        // Populate form and test results from stored report
        setFormData((prev) => ({
          ...prev,
          id: report.patientId || prev.id,
          name: report.patientName || prev.name,
          specimen: report.specimen || prev.specimen,
          examRequired: report.examRequired || prev.examRequired,
          categoryTitle: report.categoryTitle || prev.categoryTitle,
          findings: report.findings || prev.findings,
        }));

        if (Array.isArray(report.results) && report.results.length) {
          setTestResults(
            report.results.map((r) => ({
              id: createUniqueRowId(),
              isSection: false,
              test: r.test || r.name || "",
              result: r.result || r.value || "",
              units: r.units || "",
              normalValue: r.normalValue || "",
            }))
          );
        }

        // Switch to generated/print view
        setIsGenerating(true);
      } catch (err) {
        console.error("Could not load saved report:", err);
      }
    }

    loadSavedReport();
    return () => {
      ignore = true;
    };
  }, [searchParams]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTestChange = (index, field, value) => {
    const newTests = [...testResults];
    newTests[index][field] = value;
    setTestResults(newTests);
  };

  const handleReportTemplateChange = (key) => {
    const reportTemplate = getReportTemplateByKey(reportTemplates, key);
    setSelectedReportTemplate(key);
    setReportColumns(getTemplateColumns(reportTemplate));
    setFormData((prev) => ({
      ...prev,
      specimen: reportTemplate.specimen,
      examRequired: reportTemplate.examRequired,
      categoryTitle: reportTemplate.categoryTitle,
    }));
    setTestResults(cloneRows(reportTemplate.rows));
  };

  const addTestRow = () => {
    setTestResults([
      ...testResults,
      {
        id: createUniqueRowId(),
        isSection: false,
        test: "",
        result: "",
        units: "",
        normalValue: "",
      },
    ]);
  };

  const addSectionRow = () => {
    setTestResults([
      ...testResults,
      {
        id: createUniqueRowId(),
        isSection: true,
        test: "New Section",
      },
    ]);
  };

  const removeTestRow = (index) => {
    const newTests = testResults.filter((_, i) => i !== index);
    setTestResults(newTests);
  };

  const handleGenerateReport = () => {
    if (!formData.name || !formData.specimen) {
      toast.error("Please enter a patient name and select a specimen type.");
      return;
    }
    setIsGenerating(true);
  };

  const [isReportSaving, setIsReportSaving] = useState(false);

  const handlePrintReport = async () => {
    setIsReportSaving(true);
    const uniqueId = createUniqueReportId();
    const reportNumber = formData.id || uniqueId;
    const patientId = formData.id || `PAT-${uniqueId}`;

    try {
      const reportPayload = {
        reportNumber,
        patientId,
        patientName: formData.name || "Unknown Patient",
        labId: branding.labId || "default-lab",
        status: "Completed",
        templateMode, // Saves template configuration selection to dashboard dataset
        templateBranding: branding,
        patientContact: searchParams?.get("contact") || null,
        patientAge: searchParams?.get("age") || null,
        patientGender: searchParams?.get("gender") || null,
        totalBill: searchParams?.get("totalBill") || null,
        pendingBalance: searchParams?.get("pendingBalance") || null,
        registeredAt: searchParams?.get("registeredAt") || null,
        specialReferral: formData.refBy,
        specimen: formData.specimen,
        examRequired: formData.examRequired,
        categoryTitle: formData.categoryTitle,
        findings: formData.findings || `No specific findings were entered for ${formData.name || "this patient"}. Review the test table for details.`,
        generatedAt: new Date().toISOString(),
        results: testResults.filter((row) => !row.isSection).map((row) => ({
          test: row.test,
          result: row.result,
          units: row.units,
          normalValue: row.normalValue,
        })),
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Unable to save the report.");
      }

      try {
        const reportSummary = {
          reportNumber,
          generatedAt: new Date().toISOString(),
          findings: formData.findings || "Report generated.",
          status: "Completed",
        };

        const patientUpdate = await fetch("/api/patients", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: patientId,
            status: "Completed",
            lastReportNumber: reportNumber,
            action: "View Report",
            reportSummary,
            updatedAt: new Date().toISOString(),
          }),
        });

        if (!patientUpdate.ok) {
          const patientError = await patientUpdate.json();
          console.warn("Report saved but patient update failed:", patientError.message);
          toast.error("Report saved, but patient record update failed.");
        } else {
          toast.success("Report saved and patient record updated.");
        }
      } catch (updateError) {
        console.warn("Could not update patient record after report save:", updateError);
        toast.error("Report saved, but patient record could not be updated.");
      }

      window.print();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not save report before printing.");
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleDashboardNavigation = () => {
    if (onNavigateDashboard) {
      onNavigateDashboard();
    } else {
        router.push(searchParams.get("source") === "staff" ? "/staff-dashboard" : "/dashboard");
    }
  };

  const handleTemplateSave = (nextBranding) => {
    setBranding(nextBranding);
    storeBranding(nextBranding);
  };

  // --- FORM VIEW (Edit Mode) ---
  if (!isGenerating) {
    return (
      <div className="w-full max-w-4xl mx-auto my-8 font-sans text-black px-4">
        {isTemplateCustomizerOpen && (
          <TemplateCustomizer
            open={isTemplateCustomizerOpen}
            branding={branding}
            onClose={() => setIsTemplateCustomizerOpen(false)}
            onSave={handleTemplateSave}
          />
        )}

        {/* Top bar with Dashboard Action */}
        <div className="flex justify-between items-center mb-4 px-2">
          <Button 
            variant="outline" 
            onClick={handleDashboardNavigation}
            className="border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
          >
            <LayoutDashboard className="w-4 h-4 mr-2 text-slate-600" />
            Dashboard
          </Button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateCustomizerOpen(true)}
              className="border-slate-300 bg-white hover:bg-slate-100 text-slate-800"
            >
              <Settings className="w-4 h-4 mr-2 text-slate-600" />
              Edit Template
            </Button>
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-black transition-colors">
                <X className="w-5 h-5 text-slate-600" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-900">Edit Report Data</h2>
            
            {/* View Mode Switcher via Standard HTML labels */}
            <div className="bg-slate-100 p-1.5 rounded-lg border border-slate-200">
              <RadioGroup value={templateMode} onValueChange={setTemplateMode} className="flex gap-2">
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="pdf" id="mode-pdf" className="text-[#114a2f]" />
                  <label htmlFor="mode-pdf" className="text-xs font-semibold px-2 cursor-pointer flex items-center gap-1 text-slate-700 select-none">
                    <FileText className="w-3 h-3" /> Full Template (PDF)
                  </label>
                </div>
                <div className="flex items-center space-x-1">
                  <RadioGroupItem value="print" id="mode-print" className="text-[#114a2f]" />
                  <label htmlFor="mode-print" className="text-xs font-semibold px-2 cursor-pointer flex items-center gap-1 text-slate-700 select-none">
                    <Printer className="w-3 h-3" /> Plain/Pre-printed
                  </label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-black">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Report No.</label>
                <Input name="id" value={formData.id} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <Input name="date" value={formData.date} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Patient Name</label>
                <Input name="name" value={formData.name} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ref. By</label>
                <Input name="refBy" value={formData.refBy} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Specimen Type</label>
                <Select value={formData.specimen} onValueChange={(val) => setFormData({ ...formData, specimen: val })}>
                  <SelectTrigger className="border-slate-300 bg-white text-black ">
                    <SelectValue placeholder="Choose specimen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Blood">Blood</SelectItem>
                    <SelectItem value="Urine">Urine</SelectItem>
                    <SelectItem value="Stool">Stool</SelectItem>
                    <SelectItem value="Serum">Serum</SelectItem>
                    <SelectItem value="Plasma">Plasma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Examination Required</label>
                <Select value={selectedReportTemplate} onValueChange={handleReportTemplateChange} disabled={isLoadingTemplates}>
                  <SelectTrigger className="border-slate-300 bg-white text-black">
                    <SelectValue placeholder={isLoadingTemplates ? "Loading reports..." : "Choose report type"} />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTemplates.map((reportTemplate) => (
                      <SelectItem key={reportTemplate.key} value={reportTemplate.key}>
                        {reportTemplate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

         

            <div className="pt-4 border-t border-slate-200">
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Examination Name</label>
                <Input name="examRequired" value={formData.examRequired} onChange={handleInputChange} className="font-semibold uppercase" />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Report Title</label>
                <Input name="categoryTitle" value={formData.categoryTitle} onChange={handleInputChange} className="font-bold uppercase" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse mb-4 min-w-150">
                  <thead>
                    <tr className="bg-slate-200 text-sm text-black">
                      {reportColumns.map((column) => (
                        <th key={column.key} className="p-2 border border-slate-300 text-left">
                          {column.key === "test" ? "Test Name / Section" : column.label}
                        </th>
                      ))}
                      <th className="p-2 border border-slate-300 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testResults.map((row) => (
                      <tr key={row.id || createUniqueRowId()} className={`text-sm ${row.isSection ? 'bg-slate-100' : ''}`}>
                        {reportColumns.map((column) => (
                          <td key={column.key} className="border border-slate-300 p-1">
                            {column.key === "test" && (
                              <Input
                                value={row.test}
                                onChange={(e) => handleTestChange(i, "test", e.target.value)}
                                className={`h-8 border-none shadow-none focus-visible:ring-1 ${row.isSection ? 'font-bold' : ''}`}
                              />
                            )}
                            {column.key === "result" && !row.isSection && (
                              <Input value={row.result} onChange={(e) => handleTestChange(i, "result", e.target.value)} className="h-8 border-none shadow-none focus-visible:ring-1 bg-yellow-50" />
                            )}
                            {column.key === "units" && !row.isSection && (
                              <Input
                                value={row.isTwoCol ? "" : (row.units || "")}
                                onChange={(e) => handleTestChange(i, "units", e.target.value)}
                                disabled={row.isTwoCol}
                                className="h-8 border-none shadow-none focus-visible:ring-1 disabled:bg-slate-100"
                              />
                            )}
                            {column.key === "normalValue" && !row.isSection && (
                              <textarea
                                value={row.isTwoCol ? "" : (row.normalValue || "")}
                                onChange={(e) => handleTestChange(i, "normalValue", e.target.value)}
                                disabled={row.isTwoCol}
                                className="w-full min-h-8 p-1 text-sm border-none shadow-none focus-visible:outline-none focus-visible:ring-1 resize-none disabled:bg-slate-100"
                              />
                            )}
                          </td>
                        ))}
                        <td className="border border-slate-300 p-1 text-center">
                          <Button variant="ghost" size="icon" onClick={() => removeTestRow(i)} className="h-8 w-8 text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button onClick={addTestRow} variant="outline" className="flex-1 border-dashed border-2 text-slate-600">
                    <Plus className="w-4 h-4 mr-2" /> Add Test Row
                  </Button>
                  <Button onClick={addSectionRow} variant="outline" className="flex-1 border-dashed border-2 text-slate-600 bg-slate-50">
                    <Plus className="w-4 h-4 mr-2" /> Add Section Header
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleGenerateReport} className="bg-[#114a2f] text-white hover:bg-[#0a301e] w-full md:w-auto px-8 shadow-sm">
                Generate {templateMode === "pdf" ? "PDF View" : "Plain Print View"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PRINT / GENERATED VIEW (Strict 1-Page Layout Force Configuration) ---
  return (
    <div className="report-print-root w-full bg-slate-100 py-8 min-h-screen flex flex-col items-center select-text">
      {isTemplateCustomizerOpen && (
        <TemplateCustomizer
          open={isTemplateCustomizerOpen}
          branding={branding}
          onClose={() => setIsTemplateCustomizerOpen(false)}
          onSave={handleTemplateSave}
        />
      )}

      {/* Dynamic injection to control layout rendering profiles */}
      <style dangerouslySetInnerHTML={{__html: `
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body, html {
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-print-root {
            min-height: 0 !important;
            padding: 0 !important;
            background-color: #fff !important;
            display: block !important;
          }
          .print-container {
            width: 210mm !important;
            height: 297mm !important;
            max-height: 297mm !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: ${templateMode === "print" ? "25mm 12mm 15mm 12mm" : "8mm 10mm"} !important;
            position: relative !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          table {
            page-break-inside: avoid !important;
          }
          tr {
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
        }
      `}} />

      <div className="print-container bg-white w-[210mm] h-[297mm] shadow-2xl relative flex flex-col justify-between p-10 box-border print:shadow-none print:w-full">
        
        {/* Main top structural container */}
        <div className="w-full flex flex-col">
          
          {/* Lab Watermark Background - ONLY visible in PDF mode */}
          {templateMode === "pdf" && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0" style={{ opacity: Number(branding.templateWatermarkOpacity) || 0 }}>
              <Image
                src={branding.logoUrl}
                alt=""
                width={800}
                height={800}
                className="select-none object-contain"
                unoptimized
              />
            </div>
          )}

          <div className="relative z-10 text-black font-serif w-full">
            
            {/* Top Header Branding Letterhead Layout - ONLY visible in PDF mode */}
            {templateMode === "pdf" && (
              <>
<div className="flex justify-between items-center mb-1 mt-0">
  
  {/* Left Text - Aligned to Center */}
  <div className="text-left w-1/3">
    <h1 className="text-[38px] tracking-tight" style={{ color: branding.primaryColor }}>{branding.labName}</h1>
    <p className="text-[11px] font-semibold tracking-widest text-[#4a5568] ml-6.5 uppercase">{branding.tagline}</p>
  </div>
  
  {/* Center Logo */}
  <div className="w-1/3 flex justify-center">
    <div className="w-40 h-40 flex items-center justify-center relative">
      <Image
        src={branding.logoUrl}
        alt={`${branding.labName} logo`}
        fill
        className="object-contain"
        priority
        unoptimized
      />
    </div>
  </div>

  {/* Right Text - Aligned to Center */}
  <div className="text-right w-1/3">
    <h1 className="text-[52px] font-bold leading-tight" style={{ color: branding.primaryColor, fontFamily: 'Arial, sans-serif' }}>{branding.templateUrduName}</h1>
    <p className="text-[20px] font-medium text-[#4a5568] mr-10.5" style={{ fontFamily: '"Jameel Noori Nastaleeq", "Urdu Typesetting", sans-serif' }}>
      {branding.templateUrduTagline}
    </p>
  </div>
</div>
              

                <hr className="border-t border-black mb-0.5" />
                <hr className="border-t-[3px] border-black mb-4" />
              </>
            )}

            {/* Spacer margin offset layout dynamic fallback used when branding is hidden */}
            {templateMode === "print" && <div className="h-6 w-full" />}

            {/* Patient Details Metadata Table - Always visible */}
            <table className="w-full text-[13px] border border-black mb-7   mt-22">
              <tbody>
                <tr>
                  <td className="w-[15%] p-1 border border-black font-bold bg-[#f3f4f6]">No:</td>
                  <td className="w-[35%] p-1 border border-black font-bold">{formData.id}</td>
                  <td colSpan={2} className="w-[50%] p-1 border border-black font-bold text-right pr-4 bg-[#f3f4f6]">
                    {formData.date}
                  </td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-bold bg-[#f3f4f6]">Patient Name:</td>
                  <td colSpan={3} className="p-1 border border-black font-bold uppercase text-center">{formData.name}</td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-bold bg-[#f3f4f6]">Ref. By:</td>
                  <td colSpan={3} className="p-1 border border-black font-bold text-center">{formData.refBy}</td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-bold bg-[#f3f4f6]">Specimen:</td>
                  <td colSpan={3} className="p-1 border border-black font-bold text-center">{formData.specimen}</td>
                </tr>
                <tr>
                  <td className="p-1 border border-black font-bold bg-[#f3f4f6]">Examination Required:</td>
                  <td colSpan={3} className="p-1 border border-black font-bold text-center">{formData.examRequired}</td>
                </tr>
              </tbody>
            </table>

            {/* Report Title Heading */}
            <h2 className="text-[17px] font-bold text-center mb-3  uppercase tracking-wide">{formData.categoryTitle}</h2>

            {/* Structured Results Metrics Matrix Table - Always visible */}
            {groupRowsIntoTables(testResults, reportColumns).map((table, tIdx) => (
              <table key={tIdx} className="w-full text-[13px] border-collapse mb-3">
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th
                        key={column.key}
                        className={`p-1 border-b border-black font-bold ${column.key === "test" ? "text-left" : "text-center"}`}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((result) => {
                    if (result.test === "Spacer") {
                      return (
                        <tr key={result.id || createUniqueRowId()}>
                          <td colSpan={table.columns.length} className="h-3 border border-black bg-white"></td>
                        </tr>
                      );
                    }
                    
                    if (result.isSection) {
                      return (
                        <tr key={result.id || createUniqueRowId()}>
                          <td colSpan={table.columns.length} className="p-1 border border-black font-bold bg-white text-left whitespace-pre-wrap">
                            {result.test}
                          </td>
                        </tr>
                      );
                    }

                    if (result.isTwoCol) {
                      return (
                        <tr key={result.id || createUniqueRowId()}>
                          <td className="p-1 border border-black font-bold">
                            {result.test}
                          </td>
                          <td colSpan={table.columns.length - 1} className="p-1 border border-black font-bold text-center">
                            {result.result || ""}
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={result.id || createUniqueRowId()}>
                        {table.columns.map((column) => (
                          <td
                            key={column.key}
                            className={`p-1 border border-black font-bold ${column.key === "test" ? "" : "text-center"} ${column.key === "normalValue" ? "whitespace-pre-line leading-tight text-[12px]" : ""}`}
                          >
                            {result[column.key] || ""}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}

            {/* Analytical Clinical Findings if populated */}
            {formData.findings && (
              <div className="w-full p-2 border border-black text-xs font-sans mt-2">
                <strong>Clinical Notes / Findings:</strong>
                <p className="whitespace-pre-wrap mt-1 text-slate-700">{formData.findings}</p>
              </div>
            )}
          
          </div>
        </div>

        {/* Dynamic footer layer controls */}
        <div className="w-full relative z-10 text-black font-serif">
          {/* Signature Clearance Area */}
          <div className="flex justify-end mb-8 print:mb-4">
            <div className="text-center">
              <p className="text-[13px] font-bold border-t border-black/40 pt-1 px-4">{branding.templateInchargeLabel}</p>
            </div>
          </div>

          {/* Absolute Layout Address Banner Block - ONLY visible in PDF mode */}
          {templateMode === "pdf" && (
            <div className="text-white text-center py-2 text-[13px] font-bold font-sans tracking-wide -mx-10 -mb-10 print:mx-[-10mm] print:mb-[-8mm]" style={{ backgroundColor: branding.primaryColor }}>
              {branding.templateFooter}
            </div>
          )}
        </div>

      </div>

      {/* Floating Action Menu controls tray (Excluded from print output automatically) */}
      <div className="fixed bottom-8 flex gap-3 print:hidden bg-white/90 backdrop-blur-sm p-4 rounded-full shadow-lg border border-slate-200 z-50">
        <Button 
          variant="outline" 
          onClick={handleDashboardNavigation}
          className="border-slate-300 rounded-full px-4 text-slate-800 bg-white hover:bg-slate-100"
        >
          <LayoutDashboard className="w-4 h-4 mr-2 text-slate-600" />
          Dashboard
        </Button>
        <Button 
          onClick={() => setIsGenerating(false)} 
          variant="secondary" 
          className="rounded-full px-4 bg-slate-100 hover:bg-slate-200 text-slate-800"
        >
          <X className="w-4 h-4 mr-2 text-slate-600" /> 
          Edit Form
        </Button>
        <Button
          onClick={() => setIsTemplateCustomizerOpen(true)}
          variant="outline"
          className="border-slate-300 rounded-full px-4 text-slate-800 bg-white hover:bg-slate-100"
        >
          <Settings className="w-4 h-4 mr-2 text-slate-600" />
          Edit Template
        </Button>
        <Button 
          onClick={handlePrintReport} 
          disabled={isReportSaving}
          className="bg-[#114a2f] text-white hover:bg-[#0a301e] rounded-full px-8 shadow-md"
        >
          <Printer className="w-4 h-4 mr-2" /> 
          {isReportSaving ? "Saving..." : "Print Report"}
        </Button>
      </div>
    </div>
  );
}

export default function LabReportTemplate(props) {
  return (
    <React.Suspense fallback={
      <div className="w-full max-w-4xl mx-auto my-8 font-sans text-black px-4 text-center py-12">
        <p className="text-slate-500 font-medium">Loading report editor...</p>
      </div>
    }>
      <LabReportTemplateContent {...props} />
    </React.Suspense>
  );
}
