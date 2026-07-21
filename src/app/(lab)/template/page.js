"use client";

import React, { useEffect, useState } from "react";
import { flushSync } from "react-dom";
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

// Attaches each row to the column-set of the template it came from, so that
// when several report templates are merged together each one keeps its own
// columns instead of being forced into whichever template happened to load
// first. This is the source of the "conflicting template" bug.
function cloneRows(rows, tableColumns) {
  return rows.map((row) => ({
    ...row,
    id: row.id || createUniqueRowId(),
    result: row.result || "",
    tableColumns: tableColumns || row.tableColumns || DEFAULT_REPORT_COLUMNS,
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

// Single, unified matcher used everywhere a "tests" param needs to be turned
// into one-or-more report templates.
function getMatchingReportTemplates(templates, examString) {
  const requestedTests = (examString || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (requestedTests.length <= 1) {
    return [getReportTemplateFromExam(templates, examString)];
  }

  const matched = [];
  const seenKeys = new Set();

  requestedTests.forEach((test) => {
    const bestMatch = getReportTemplateFromExam(templates, test);
    if (bestMatch && !seenKeys.has(bestMatch.key)) {
      seenKeys.add(bestMatch.key);
      matched.push(bestMatch);
    }
  });

  return matched.length ? matched : [getReportTemplateFromExam(templates, examString)];
}

function createUniqueReportId() {
  return `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function createUniqueRowId() {
  return `ROW-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function getInitialFormData(searchParams, reportTemplate, patientData) {
  const getParam = (key) => {
    if (patientData && patientData[key] !== undefined) return patientData[key];
    return searchParams.get(key);
  };

  const patientId = getParam("patientId");
  const patientName = getParam("patientName");
  const tests = getParam("tests");
  const registeredAt = getParam("registeredAt");

  return {
    id: patientId || createUniqueReportId(),
    caseNumber: getParam("caseNumber") || getParam("reportNumber") || "",
    date: registeredAt || new Date().toISOString().split('T')[0],
    name: patientName || "Patient",
    age: getParam("age") || "",
    gender: getParam("gender") || "",
    bloodGroup: getParam("bloodGroup") || "Unknown",
    nic: getParam("nic") || "",
    contact: getParam("contact") || getParam("phone") || "",
    address: getParam("address") || "",
    registrationLocation: getParam("registrationLocation") || "",
    destinationLocation: getParam("destinationLocation") || "",
    refBy: getParam("refDoctor") || getParam("refBy") || "Self",
    consultant: getParam("consultant") || "",
    specimen: getParam("specimen") || reportTemplate.specimen || "Blood",
    examRequired: tests || reportTemplate.examRequired || "",
    categoryTitle: reportTemplate.categoryTitle || "LABORATORY REPORT",
    findings: "",
  };
}

function paginateRows(rows, mode) {
  const pages = [];
  let currentPage = [];
  let currentUnits = 0;

  // Capacity is deliberately conservative. A result can wrap onto several
  // lines (especially reference ranges), so treating every row as one line
  // caused the fixed-size print page to cut off the last rows.
  const firstPageCapacity = mode === "pdf" ? 8 : 11;
  const subsequentPageCapacity = 15;

  let isFirstPage = true;

  rows.forEach((row) => {
    let rowUnits = 1;
    if (row.isSection) rowUnits = 1.5;
    if (row.newTable) rowUnits += 1.25;

    const columns = row.tableColumns || DEFAULT_REPORT_COLUMNS;
    const longestCell = columns.reduce((longest, column) => {
      const value = String(row[column.key] || "");
      const charactersPerLine = column.key === "test" ? 32 : 18;
      return Math.max(longest, Math.ceil(value.length / charactersPerLine));
    }, 1);
    rowUnits += Math.max(0, longestCell - 1) * 0.8;

    const capacity = isFirstPage ? firstPageCapacity : subsequentPageCapacity;

    if (currentUnits + rowUnits > capacity && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentUnits = 0;
      isFirstPage = false;
    }

    currentPage.push(row);
    currentUnits += rowUnits;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
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

    (async () => {
      try {
        const fd = new FormData();
        fd.append('image', file);

        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Upload failed');

        updateDraft('logoUrl', data.imageUrl);
        toast.success('Report logo uploaded');
      } catch (err) {
        console.error('Report logo upload failed', err);
        toast.error(err.message || 'Could not upload report logo');
      }
    })();
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

// Decorative barcode-style block. Purely visual (matches the look of a
// scanned lab report) - swap for a real barcode library (e.g. jsbarcode) if
// the barcode needs to be scannable.
function BarcodeStrip({ value }) {
  return (
    <div className="flex flex-col items-end">
      <div
        className="h-8 w-48"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, #000 0px, #000 2px, transparent 2px, transparent 3px, #000 3px, #000 4px, transparent 4px, transparent 6px)",
        }}
      />
      <span className="mt-0.5 text-[10px] tracking-widest text-slate-700">{value}</span>
    </div>
  );
}

function LabReportTemplateContent({ onClose, onNavigateDashboard, patientData, onReportSaved }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [branding, setBranding] = useState(readStoredBranding);
  const [isTemplateCustomizerOpen, setIsTemplateCustomizerOpen] = useState(false);
  const [reportTemplates, setReportTemplates] = useState(REPORT_TEMPLATES);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateMode, setTemplateMode] = useState("pdf");
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);

  const getParam = (key) => {
    if (patientData && patientData[key] !== undefined) {
      return patientData[key];
    }
    return searchParams.get(key);
  };

  const testsParam = getParam("tests");

  const [selectedReportTemplates, setSelectedReportTemplates] = useState(() => {
    const matched = getReportTemplateFromExam(REPORT_TEMPLATES, testsParam);
    return matched ? [matched.key] : [];
  });

  const [reportColumns, setReportColumns] = useState(() => getTemplateColumns(getReportTemplateFromExam(REPORT_TEMPLATES, testsParam)));

  const [formData, setFormData] = useState(() => {
    const reportTemplate = getReportTemplateFromExam(REPORT_TEMPLATES, testsParam);
    return getInitialFormData(searchParams, reportTemplate, patientData);
  });

  const [testResults, setTestResults] = useState(() => {
    const initialTemplate = getReportTemplateByKey(REPORT_TEMPLATES, selectedReportTemplates[0] || "loading");
    return cloneRows(initialTemplate.rows, getTemplateColumns(initialTemplate));
  });

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
        setReportTemplates(nextTemplates);

        if (getParam("source") === "report") {
          return;
        }

        const testsParam = getParam("tests");
        const matchedTemplates = getMatchingReportTemplates(nextTemplates, testsParam);
        const keysToSelect = matchedTemplates.map((t) => t.key);

        setSelectedReportTemplates(keysToSelect);

        const templatesToMerge = nextTemplates.filter(t => keysToSelect.includes(t.key));
        const combinedRows = [];

        templatesToMerge.forEach((template, idx) => {
          const tplColumns = getTemplateColumns(template);
          if (templatesToMerge.length > 1) {
            combinedRows.push({
              id: `section-${template.key}-${Date.now()}-${idx}`,
              isSection: true,
              test: template.label.toUpperCase(),
              result: "",
              units: "",
              normalValue: "",
              newTable: true,
              tableColumns: tplColumns,
            });
          }
          combinedRows.push(...cloneRows(template.rows, tplColumns));
        });

        const firstTemplate = templatesToMerge[0] || nextTemplates[0];
        setReportColumns(getTemplateColumns(firstTemplate));

        setFormData((prev) => ({
          ...prev,
          specimen: getParam("specimen") || firstTemplate.specimen,
          examRequired: getParam("tests") || templatesToMerge.map(t => t.label).join(", ") || firstTemplate.examRequired,
          categoryTitle: templatesToMerge.length > 1 ? "LABORATORY REPORT" : firstTemplate.categoryTitle,
        }));
        setTestResults(combinedRows);
      } catch (error) {
        console.error(error);
        toast.error(error.message || "Could not load report templates.");
      } finally {
        if (!ignore) setIsLoadingTemplates(false);
      }
    }

    loadReportTemplates();

    return () => {
      ignore = true;
    };
  }, [searchParams, patientData]);

  useEffect(() => {
    let ignore = false;
    async function loadSavedReport() {
      const source = getParam("source");
      const reportNumber = getParam("reportNumber") || getParam("lastReportNumber");
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

        setFormData((prev) => ({
          ...prev,
          id: report.patientId || prev.id,
          caseNumber: report.caseNumber || report.reportNumber || prev.caseNumber,
          name: report.patientName || prev.name,
          age: report.patientAge || prev.age,
          gender: report.patientGender || prev.gender,
          bloodGroup: report.bloodGroup || prev.bloodGroup,
          nic: report.nic || prev.nic,
          contact: report.patientContact || prev.contact,
          address: report.address || prev.address,
          registrationLocation: report.registrationLocation || prev.registrationLocation,
          destinationLocation: report.destinationLocation || prev.destinationLocation,
          refBy: report.specialistReferral || report.specialReferral || prev.refBy,
          consultant: report.consultant || prev.consultant,
          specimen: report.specimen || prev.specimen,
          examRequired: report.examRequired || prev.examRequired,
          categoryTitle: report.categoryTitle || prev.categoryTitle,
          findings: report.findings || prev.findings,
        }));

        if (Array.isArray(report.results) && report.results.length) {
          setTestResults(
            report.results.map((r) => ({
              id: createUniqueRowId(),
              isSection: r.isSection || false,
              isTwoCol: r.isTwoCol || false,
              newTable: r.newTable || false,
              test: r.test || r.name || "",
              result: r.result || r.value || "",
              units: r.units || "",
              normalValue: r.normalValue || "",
              tableColumns: r.tableColumns || DEFAULT_REPORT_COLUMNS,
            }))
          );
        }

        setIsGenerating(true);
      } catch (err) {
        console.error("Could not load saved report:", err);
      }
    }

    loadSavedReport();
    return () => {
      ignore = true;
    };
  }, [searchParams, patientData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTestChange = (index, field, value) => {
    const newTests = [...testResults];
    newTests[index][field] = value;
    setTestResults(newTests);
  };

  const handleTemplateToggle = (key) => {
    setSelectedReportTemplates((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];

      const templatesToMerge = reportTemplates.filter((t) => next.includes(t.key));
      const combinedRows = [];

      templatesToMerge.forEach((template, idx) => {
        const tplColumns = getTemplateColumns(template);
        if (templatesToMerge.length > 1) {
          combinedRows.push({
            id: `section-${template.key}-${Date.now()}-${idx}`,
            isSection: true,
            test: template.label.toUpperCase(),
            result: "",
            units: "",
            normalValue: "",
            newTable: true,
            tableColumns: tplColumns,
          });
        }
        combinedRows.push(...cloneRows(template.rows, tplColumns));
      });

      const firstTemplate = templatesToMerge[0] || reportTemplates[0];
      setFormData((prevForm) => ({
        ...prevForm,
        specimen: firstTemplate?.specimen || prevForm.specimen,
        examRequired: templatesToMerge.map((t) => t.label).join(", ") || "Laboratory Report",
        categoryTitle: templatesToMerge.length > 1 ? "LABORATORY REPORT" : (firstTemplate?.categoryTitle || "LABORATORY REPORT"),
      }));

      setTestResults(combinedRows);
      if (firstTemplate) {
        setReportColumns(getTemplateColumns(firstTemplate));
      }

      return next;
    });
  };

  const addTestRow = () => {
    const lastRow = testResults[testResults.length - 1];
    const tplColumns = lastRow?.tableColumns || reportColumns;
    setTestResults([
      ...testResults,
      {
        id: createUniqueRowId(),
        isSection: false,
        test: "",
        result: "",
        units: "",
        normalValue: "",
        tableColumns: tplColumns,
      },
    ]);
  };

  const addSectionRow = () => {
    const lastRow = testResults[testResults.length - 1];
    const tplColumns = lastRow?.tableColumns || reportColumns;
    setTestResults([
      ...testResults,
      {
        id: createUniqueRowId(),
        isSection: true,
        test: "New Section",
        tableColumns: tplColumns,
      },
    ]);
  };

  const removeTestRow = (index) => {
    const newTests = testResults.filter((_, i) => i !== index);
    setTestResults(newTests);
  };

  const handleGenerateAndPrintReport = () => {
    if (!formData.name || !formData.specimen) {
      toast.error("Please enter a patient name and select a specimen type.");
      return;
    }

    // Commit every paginated report page before saving and opening print.
    flushSync(() => setIsGenerating(true));
    void handleReportOutput("print");
  };

  const [isReportSaving, setIsReportSaving] = useState(false);

  const openReportPrintDialog = async (output) => {
    // Wait for fonts and the latest report layout before opening the dialog.
    // This prevents a PDF/print preview from capturing a partially rendered page.
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const reportImages = Array.from(document.querySelectorAll(".report-print-root img"));
    await Promise.all(reportImages.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      });
    }));

    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    if (output === "pdf") {
      toast.info("Select 'Save as PDF' in the print dialog to download the complete report.");
    }
    window.print();
  };

  const handleReportOutput = async (output = "print") => {
    setIsReportSaving(true);
    const uniqueId = createUniqueReportId();
    const reportNumber = formData.id || uniqueId;
    const patientId = formData.id || `PAT-${uniqueId}`;

    try {
      const reportPayload = {
        reportNumber,
        caseNumber: formData.caseNumber || reportNumber,
        patientId,
        patientName: formData.name || "Unknown Patient",
        labId: branding.labId || "default-lab",
        status: "Completed",
        templateMode,
        templateBranding: branding,
        patientContact: formData.contact || getParam("contact") || null,
        patientAge: formData.age || getParam("age") || null,
        patientGender: formData.gender || getParam("gender") || null,
        bloodGroup: formData.bloodGroup || null,
        nic: formData.nic || null,
        address: formData.address || null,
        registrationLocation: formData.registrationLocation || null,
        destinationLocation: formData.destinationLocation || null,
        consultant: formData.consultant || null,
        totalBill: getParam("totalBill") || null,
        pendingBalance: getParam("pendingBalance") || null,
        registeredAt: getParam("registeredAt") || null,
        specialistReferral: formData.refBy,
        specialReferral: formData.refBy,
        specimen: formData.specimen,
        examRequired: formData.examRequired,
        categoryTitle: formData.categoryTitle,
        findings: formData.findings || "",
        generatedAt: new Date().toISOString(),
        results: testResults.map((row) => ({
          test: row.test,
          result: row.result,
          units: row.units || "",
          normalValue: row.normalValue || "",
          isSection: row.isSection || false,
          isTwoCol: row.isTwoCol || false,
          newTable: row.newTable || false,
          tableColumns: row.tableColumns || DEFAULT_REPORT_COLUMNS,
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
          if (onReportSaved) {
            onReportSaved();
          }
        }
      } catch (updateError) {
        console.warn("Could not update patient record after report save:", updateError);
        toast.error("Report saved, but patient record could not be updated.");
      }

      await openReportPrintDialog(output);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Could not save report before printing.");
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleDashboardNavigation = () => {
    if (onClose) {
      onClose();
    } else if (onNavigateDashboard) {
      onNavigateDashboard();
    } else {
      router.push(getParam("source") === "staff" ? "/staff-dashboard" : "/dashboard");
    }
  };

  const handleTemplateSave = (nextBranding) => {
    setBranding(nextBranding);
    storeBranding(nextBranding);
  };

  const pages = paginateRows(testResults, templateMode);
  const activePages = pages.length > 0 ? pages : [[]];

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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Case No.</label>
                <Input name="caseNumber" value={formData.caseNumber} onChange={handleInputChange} />
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
                <label className="block text-sm font-semibold text-slate-700 mb-1">Age</label>
                <Input name="age" value={formData.age} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Gender</label>
                <Input name="gender" value={formData.gender} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Blood Group</label>
                <Input name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">NIC</label>
                <Input name="nic" value={formData.nic} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
                <Input name="contact" value={formData.contact} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                <Input name="address" value={formData.address} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Registration Location</label>
                <Input name="registrationLocation" value={formData.registrationLocation} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Destination Location</label>
                <Input name="destinationLocation" value={formData.destinationLocation} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Ref. By</label>
                <Input name="refBy" value={formData.refBy} onChange={handleInputChange} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Consultant</label>
                <Input name="consultant" value={formData.consultant} onChange={handleInputChange} />
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
                    {formData.specimen && !["Blood", "Urine", "Stool", "Serum", "Plasma"].includes(formData.specimen) && (
                      <SelectItem value={formData.specimen}>{formData.specimen}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">Examination Required</label>
                <button
                  type="button"
                  onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
                  disabled={isLoadingTemplates}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-black shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="truncate">
                    {isLoadingTemplates
                      ? "Loading reports..."
                      : selectedReportTemplates.length > 0
                        ? `${selectedReportTemplates.length} selected`
                        : "Choose report type(s)"}
                  </span>
                  <span className="text-xs text-slate-500">▼</span>
                </button>

                {isTemplateDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsTemplateDropdownOpen(false)} />
                    <div className="absolute right-0 left-0 z-20 mt-1 max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white p-2 shadow-lg animate-in fade-in duration-100">
                      {reportTemplates.map((tpl) => {
                        const isChecked = selectedReportTemplates.includes(tpl.key);
                        return (
                          <label
                            key={tpl.key}
                            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTemplateToggle(tpl.key)}
                              className="h-4 w-4 rounded-sm border-slate-300 text-[#114a2f] focus:ring-emerald-500"
                            />
                            <span>{tpl.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
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

              {/*
                Each selected report template renders as its own table, with
                its own column headers, instead of one flat table forced to
                use a single template's columns.
              */}
              <div className="overflow-x-auto space-y-6">
                {(() => {
                  const groupedTables = groupRowsIntoTables(testResults, reportColumns);
                  return groupedTables.map((table, tIdx) => (
                    <div key={tIdx} className="rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full border-collapse min-w-150">
                        <thead>
                          <tr className="bg-slate-800 text-sm text-white">
                            {table.columns.map((column) => (
                              <th key={column.key} className="p-2 border border-slate-700 text-left font-semibold tracking-wide">
                                {column.key === "test" ? "Test Name / Section" : column.label}
                              </th>
                            ))}
                            <th className="p-2 border border-slate-700 text-center w-12">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, idxInTable) => {
                            const globalIndex = table.rows.length * tIdx + idxInTable;
                            const i = globalIndex;
                            return (
                              <tr key={row.id || i} className={`text-sm ${row.isSection ? 'bg-emerald-50' : 'odd:bg-white even:bg-slate-50'}`}>

                                {table.columns.map((column) => (
                                  <td key={column.key} className="border border-slate-200 p-1">
                                    {column.key === "test" && (
                                      <Input
                                        value={row.test}
                                        onChange={(e) => handleTestChange(i, "test", e.target.value)}
                                        className={`h-8 border-none shadow-none focus-visible:ring-1 ${row.isSection ? 'font-bold uppercase text-[#114a2f]' : ''}`}
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
                                <td className="border border-slate-200 p-1 text-center">
                                  <Button variant="ghost" size="icon" onClick={() => removeTestRow(i)} className="h-8 w-8 text-red-500 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ));
                })()}
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
              <Button onClick={handleGenerateAndPrintReport} className="bg-[#114a2f] text-white hover:bg-[#0a301e] w-full md:w-auto px-8 shadow-sm">
                <Printer className="w-4 h-4 mr-2" /> Generate & Print All Pages
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- PRINT / GENERATED VIEW ---
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

      <style dangerouslySetInnerHTML={{__html: `
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          /*
            THE FIX FOR "ONLY ONE PAGE / LOOKS LIKE A SCREENSHOT":
            If this component is rendered inside a modal, drawer, or any
            ancestor with a fixed height + overflow (a scroll container),
            window.print() will only be able to print what's inside that
            ancestor's visible box - everything past it gets clipped, which
            looks exactly like a single-page screenshot instead of a real
            multi-page document.
            The fix: hide every other element on the page, then pull the
            report out of normal flow with position:fixed so it completely
            ignores any parent's height/overflow/transform constraints, and
            let @page + page-break-after handle the actual pagination.
          */
          html, body {
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden !important;
          }
          .report-print-root,
          .report-print-root * {
            visibility: visible !important;
          }
          .report-print-root {
            position: fixed !important;
            inset: 0 !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            transform: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background-color: #fff !important;
            display: block !important;
            z-index: 2147483647 !important;
          }
          .print-container {
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            box-shadow: none !important;
            margin: 0 auto !important;
            padding: ${templateMode === "print" ? "20mm 12mm 14mm 12mm" : "10mm 12mm"} !important;
            position: relative !important;
            overflow: visible !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .print-container:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          table {
            break-inside: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid-page !important;
          }
          td, th, p {
            overflow-wrap: anywhere !important;
          }
        }
      `}} />

      {activePages.map((pageRows, pageIdx) => {
        const isFirstPage = pageIdx === 0;
        const isLastPage = pageIdx === activePages.length - 1;

        return (
          <div
            key={pageIdx}
            className="print-container bg-white w-[210mm] min-h-[297mm] shadow-2xl relative flex flex-col justify-between p-10 box-border print:shadow-none print:w-full print:mb-0 mb-8"
          >
            <div className="w-full flex flex-col">
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

                {templateMode === "pdf" && isFirstPage && (
                  <>
                    {/* Header: logo + lab name (left) / Patient # + Case # with barcode block (right) */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 relative shrink-0">
                          <Image
                            src={branding.logoUrl}
                            alt={`${branding.labName} logo`}
                            fill
                            className="object-contain"
                            priority
                            unoptimized
                          />
                        </div>
                        <div>
                          <h1 className="text-[30px] leading-[1.05] font-bold tracking-tight" style={{ color: branding.primaryColor }}>
                            {branding.labName}
                          </h1>
                          <p className="text-[11px] font-semibold tracking-widest text-[#4a5568] uppercase">{branding.tagline}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 font-sans">
                        <div className="flex items-center justify-end gap-2 mb-1">
                          <span className="text-[12px] font-bold text-slate-700">Patient #:</span>
                          <BarcodeStrip value={formData.id} />
                        </div>
                        {formData.caseNumber && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-[12px] font-bold text-slate-700">Case #:</span>
                            <BarcodeStrip value={formData.caseNumber} />
                          </div>
                        )}
                      </div>
                    </div>

                    <hr className="border-t border-black mb-0.5" />
                    <hr className="border-t-[3px] mb-4" style={{ borderColor: branding.primaryColor }} />

                    {/* Patient info strip */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px] font-sans mb-3">
                      <div className="grid grid-cols-[110px_1fr] gap-y-1">
                        <span className="font-bold text-slate-700">Patient Name:</span>
                        <span className="uppercase">{formData.name}</span>
                        <span className="font-bold text-slate-700">Age/Sex:</span>
                        <span>{[formData.age && `${formData.age} Year(s)`, formData.gender].filter(Boolean).join(" / ") || "-"}</span>
                        <span className="font-bold text-slate-700">Blood Group:</span>
                        <span>{formData.bloodGroup || "Unknown"}</span>
                        <span className="font-bold text-slate-700">NIC:</span>
                        <span>{formData.nic || "-"}</span>
                        <span className="font-bold text-slate-700">Phone:</span>
                        <span>{formData.contact || "-"}</span>
                        <span className="font-bold text-slate-700">Address:</span>
                        <span>{formData.address || "-"}</span>
                      </div>
                      <div className="grid grid-cols-[150px_1fr] gap-y-1">
                        <span className="font-bold text-slate-700">Registration Date:</span>
                        <span>{formData.date}</span>
                        <span className="font-bold text-slate-700">Registration Location:</span>
                        <span>{formData.registrationLocation || "-"}</span>
                        <span className="font-bold text-slate-700">Destination Location:</span>
                        <span>{formData.destinationLocation || "-"}</span>
                        <span className="font-bold text-slate-700">Reference:</span>
                        <span>{formData.refBy || "Self"}</span>
                        <span className="font-bold text-slate-700">Consultant:</span>
                        <span>{formData.consultant || "-"}</span>
                      </div>
                    </div>

                    <div className="border-t border-dashed border-slate-400 mb-3" />
                  </>
                )}

                {!isFirstPage && (
                  <div className="flex justify-between items-center border-b border-slate-300 pb-2 mb-4 font-sans">
                    <span className="text-xs font-semibold text-slate-500">{branding.labName}</span>
                    <span className="text-xs font-semibold text-slate-500">Patient: {formData.name} (Lab No: {formData.id})</span>
                  </div>
                )}

                {templateMode === "print" && isFirstPage && <div className="h-6 w-full" />}

                {isFirstPage && (
                  <div className="flex items-end justify-between mb-2">
                    <h2 className="text-[16px] font-bold uppercase tracking-wide">
                      {formData.categoryTitle}:
                    </h2>
                    <div className="text-right font-sans">
                      <div className="border border-slate-400 px-3 py-0.5 text-[11px] font-bold uppercase text-slate-700 mb-1">Result</div>
                      <BarcodeStrip value={`${formData.id} · ${formData.date}`} />
                    </div>
                  </div>
                )}

                {groupRowsIntoTables(pageRows, reportColumns).map((table, tIdx) => (
                  <div key={tIdx} className={tIdx > 0 ? "mt-7" : ""}>
                    {tIdx > 0 && (
                      <div className="flex items-center gap-3 mb-2">
                        <span className="h-[2px] flex-1" style={{ backgroundColor: branding.primaryColor, opacity: 0.35 }} />
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: branding.primaryColor, opacity: 0.5 }} />
                        <span className="h-[2px] flex-1" style={{ backgroundColor: branding.primaryColor, opacity: 0.35 }} />
                      </div>
                    )}
                    <table className="w-full text-[13px] border-collapse mb-3">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="p-1.5 border-b-2 border-black font-bold text-left">TEST</th>
                          {table.columns.map((column) => (
                            <th
                              key={column.key}
                              className="p-1.5 border-b-2 border-black font-bold text-left"
                            >
                              {column.label}
                            </th>
                          ))}
                          <th className="p-1.5 border-b-2 border-black font-bold text-right">RESULT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((result) => {
                          if (result.test === "Spacer") {
                            return (
                              <tr key={result.id || createUniqueRowId()}>
                                <td colSpan={table.columns.length + 2} className="h-3"></td>
                              </tr>
                            );
                          }

                          if (result.isSection) {
                            return (
                              <tr key={result.id || createUniqueRowId()}>
                                <td colSpan={table.columns.length + 2} className="pt-3 pb-1.5 font-bold uppercase tracking-wide text-[13px] border-b border-black whitespace-pre-wrap">
                                  {result.test}
                                </td>
                              </tr>
                            );
                          }

                          if (result.isTwoCol) {
                            return (
                              <tr key={result.id || createUniqueRowId()} className="border-b border-slate-200">
                                <td className="p-1 font-semibold">{result.test}</td>
                                <td colSpan={table.columns.length + 1} className="p-1 font-bold text-right">
                                  {result.result || ""}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={result.id || createUniqueRowId()} className="border-b border-slate-200">
                              <td className="p-1 align-top">{result.test}</td>
                              {table.columns.map((column) => (
                                <td
                                  key={column.key}
                                  className={`p-1 align-top ${column.key === "normalValue" ? "whitespace-pre-line leading-tight text-[12px] text-slate-600" : ""}`}
                                >
                                  {result[column.key] || ""}
                                </td>
                              ))}
                              <td className="p-1 align-top text-right font-bold">
                                {result.result || ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}

                {isLastPage && formData.findings &&
                 !formData.findings.includes("No specific findings were entered") &&
                 !formData.findings.includes("Report generated automatically") &&
                 formData.findings !== "Report generated." &&
                 formData.findings.trim() !== "" && (
                  <div className="w-full p-2 border border-black text-xs font-sans mt-2">
                    <strong>Clinical Notes / Findings:</strong>
                    <p className="whitespace-pre-wrap mt-1 text-slate-700">{formData.findings}</p>
                  </div>
                )}

              </div>
            </div>

            <div className="w-full relative z-10 text-black font-serif">
              {isLastPage && (
                <>
                  <hr className="border-t border-black mt-6 mb-2" />
                  <p className="text-center text-[11px] font-sans font-semibold text-slate-700 mb-6">
                    Electronically verified report. No signature(s) required.
                  </p>
                </>
              )}

              <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-100 pt-2 mb-2 print:mb-1 font-sans">
                <span>Printed on: {new Date().toLocaleDateString()}</span>
                <span>Page {pageIdx + 1} of {activePages.length}</span>
              </div>

              {isLastPage && (
                <div className="flex justify-center mb-2 print:mb-1">
                  <p className="text-[12px] font-bold pt-1 px-4 font-sans">{branding.templateInchargeLabel}</p>
                </div>
              )}

              {templateMode === "pdf" && (
                <div className="text-white text-center py-2 text-[12px] font-bold font-sans tracking-wide -mx-10 -mb-10 print:mx-[-10mm] print:mb-[-8mm]" style={{ backgroundColor: branding.primaryColor }}>
                  {branding.templateFooter}
                </div>
              )}
            </div>
          </div>
        );
      })}

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
          onClick={() => handleReportOutput("pdf")}
          disabled={isReportSaving}
          variant="outline"
          className="border-[#114a2f] text-[#114a2f] hover:bg-emerald-50 rounded-full px-6"
        >
          <FileText className="w-4 h-4 mr-2" />
          Save as PDF
        </Button>
        <Button
          onClick={() => handleReportOutput("print")}
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