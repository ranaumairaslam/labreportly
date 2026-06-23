import { readdir, readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPORTS_DIR = path.join(process.cwd(), "public", "reports");
const SUPPORTED_EXTENSIONS = new Set([".doc", ".docx", ".xls", ".xlsx"]);

const DEFAULT_COLUMNS = [
  { key: "test", label: "TEST" },
  { key: "result", label: "RESULT" },
  { key: "units", label: "UNITS" },
  { key: "normalValue", label: "NORMAL VALUE" },
];

// ─── IMPORTANT: WINDOWS_1252_CONTROLS must be defined BEFORE cleanCell/cleanMultiline ───
// BUG FIX #1: In the original code, WINDOWS_1252_CONTROLS was defined AFTER cleanCell
// and cleanMultiline which reference it — this caused a Temporal Dead Zone (TDZ)
// ReferenceError at runtime in ES modules because `const` is not hoisted.
const WINDOWS_1252_CONTROLS = {
  0x82: ",",
  0x84: ",,",
  0x85: "...",
  0x91: "'",
  0x92: "'",
  0x93: '"',
  0x94: '"',
  0x95: "-",
  0x96: "-",
  0x97: "-",
};

function cleanCell(value) {
  return (value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0080-\u009f]/g, (char) => WINDOWS_1252_CONTROLS[char.charCodeAt(0)] || " ")
    .replace(/[\u0001-\u0006\u0008-\u0009\u000b-\u000c\u000e-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanMultiline(value) {
  return (value || "")
    .replace(/\u0000/g, " ")
    .replace(/[\u0080-\u009f]/g, (char) => WINDOWS_1252_CONTROLS[char.charCodeAt(0)] || " ")
    .replace(/[\u0001-\u0006\u0008-\u0009\u000b-\u000c\u000e-\u001f]/g, " ")
    .split(/\r\n|\r|\n/)
    .map((line) => cleanCell(line))
    .filter(Boolean)
    .join("\n");
}

function labelFromFileName(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isReportTemplateFile(fileName) {
  const label = labelFromFileName(fileName).toLowerCase();
  return (
    SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase()) &&
    !/^doctors?\s+name\b/.test(label)
  );
}

function likelySpecimen(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes("urine")) return "Urine";
  if (normalized.includes("stool")) return "Stool";
  if (normalized.includes("semen")) return "Semen";
  if (normalized.includes("sputum")) return "Sputum";
  if (normalized.includes("serum")) return "Serum";
  if (normalized.includes("plasma")) return "Plasma";
  if (normalized.includes("milk")) return "Milk";
  if (normalized.includes("fluid")) return "Fluid";
  return "Blood";
}

// ─── BUG FIX #2: Replace raw binary heuristic with proper library-based extraction ───
// Original code read .docx/.xlsx (ZIP-based formats) as raw binary and tried to decode
// them with TextDecoder — this produces garbled garbage because these are ZIP archives.
// .doc/.xls are OLE Compound Documents and equally unreadable as raw text.
// Fix: use mammoth for .docx/.doc and SheetJS (xlsx) for .xlsx/.xls.

async function extractTextFromDocx(buffer) {
  // mammoth converts .docx to plain text, preserving table structure with tab separators
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  return result.value || "";
}

async function extractTextFromDoc(buffer) {
  // For legacy .doc (OLE format), mammoth also supports it
  try {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({ buffer });
    if (result.value && result.value.trim().length > 20) {
      return result.value;
    }
  } catch {
    // fall through to raw extraction below
  }
  // Fallback: raw Windows-1252 decode (works for simple .doc files)
  return new TextDecoder("windows-1252").decode(buffer);
}

async function extractTextFromXlsx(buffer, label) {
  // SheetJS reads .xlsx and .xls and gives us structured cell data
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return "";

  const sheet = workbook.Sheets[sheetName];
  // Convert to tab-separated values so our existing row parser can handle it
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: "\t", RS: "\n" });
  return csv;
}

async function extractTextFromFile(filePath, ext) {
  const buffer = await readFile(filePath);
  switch (ext) {
    case ".docx":
      return extractTextFromDocx(buffer);
    case ".doc":
      return extractTextFromDoc(buffer);
    case ".xlsx":
    case ".xls":
      return extractTextFromXlsx(buffer);
    default:
      return new TextDecoder("windows-1252").decode(buffer);
  }
}

function extractBetween(text, startPattern, endPattern) {
  const startMatch = text.match(startPattern);
  if (!startMatch) return "";
  const startIndex = startMatch.index + startMatch[0].length;
  const remaining = text.slice(startIndex);
  const endMatch = remaining.match(endPattern);
  return endMatch ? remaining.slice(0, endMatch.index) : remaining;
}

function getMetadata(text, label) {
  const specimenMatch = text.match(/Specimen:\s*([^\u0007\r\n]+)/i);
  const examMatch = text.match(/Examination Required:\s*([^\u0007\r\n]+)/i);
  const headerBlock = extractBetween(
    text,
    /Examination Required:\s*[^\r\n]+/i,
    /TEST\s+RESULT(?:\s+UNITS)?(?:\s+NORMAL VALUE)?/i
  );
  const title = headerBlock
    .split(/\r\n|\r|\n/)
    .map((line) => cleanCell(line))
    .find((line) => /REPORT|PROFILE|ANALYSIS|TEST/i.test(line));

  return {
    specimen: cleanCell(specimenMatch?.[1]) || likelySpecimen(label),
    examRequired: cleanCell(examMatch?.[1]) || label,
    categoryTitle: title || "LABORATORY REPORT",
  };
}

function rowsFromFileName(label) {
  const tests = label
    .split(/[.+,&/-]+|\s{2,}/)
    .map((part) => cleanCell(part))
    .filter((part) => part && !/^(al|jannat|lab|profile|complete)$/i.test(part));

  return (tests.length ? tests : [label]).map((test) => ({
    isSection: false,
    test,
    result: "",
    units: "",
    normalValue: "",
  }));
}

function getColumnsFromHeader(header) {
  const normalizedHeader = cleanCell(header).toUpperCase();
  if (!normalizedHeader.includes("UNITS") && normalizedHeader.includes("NORMAL VALUE")) {
    return DEFAULT_COLUMNS.filter((column) => column.key !== "units");
  }
  if (!normalizedHeader.includes("UNITS") && !normalizedHeader.includes("NORMAL VALUE")) {
    return DEFAULT_COLUMNS.filter((column) => ["test", "result"].includes(column.key));
  }
  return DEFAULT_COLUMNS;
}

function getTableParts(text) {
  const headerMatch = text.match(/TEST\s+RESULT(?:\s+UNITS)?(?:\s+NORMAL VALUE)?/i);
  if (!headerMatch) {
    return { columns: DEFAULT_COLUMNS, tableText: "" };
  }

  const remaining = text.slice(headerMatch.index + headerMatch[0].length);
  const endMatch = remaining.match(
    /NOTE|Lab\s+incharge|Lab\s+Incharge|Laboratory\s+Incharge|Signature/i
  );
  return {
    columns: getColumnsFromHeader(headerMatch[0]),
    tableText: endMatch ? remaining.slice(0, endMatch.index) : remaining,
  };
}

function rowFromCells(cells, columns) {
  const values = {};
  columns.forEach((column, index) => {
    values[column.key] = cells[index] || "";
  });

  const testLines = (values.test || "").split("\n").map(cleanCell).filter(Boolean);
  const test = testLines.pop();
  const rows = testLines.map((section) => ({ isSection: true, test: section }));

  if (test) {
    rows.push({
      isSection: false,
      test,
      result: "",
      units: values.units || "",
      normalValue: values.normalValue || "",
    });
  }

  return rows;
}

// ─── BUG FIX #3: parseRows now also handles newline-delimited tables from xlsx/docx ───
// mammoth outputs tables as tab-separated rows separated by newlines.
// SheetJS sheet_to_csv already gives tab-separated values.
// The original code only split on \u0007 (a raw .doc artifact) and missed \t entirely.
function parseRows(text, label, columns) {
  const { tableText } = getTableParts(text);
  if (!tableText) return rowsFromFileName(label);

  const rows = [];
  const columnCount = columns.length;

  // BUG FIX #3a: Normalize both \u0007 (legacy .doc bell char) AND literal \t as delimiters
  const cells = tableText
    .replace(/\u0007/g, "\t")
    .split("\t")
    .map((cell) => cleanMultiline(cell));

  while (cells.length > 0 && !cells[0]) cells.shift();
  while (cells.length > 0 && !cells[cells.length - 1]) cells.pop();

  for (let index = 0; index < cells.length; ) {
    if (!cells[index]) {
      index += 1;
      continue;
    }

    const chunk = cells.slice(index, index + columnCount);
    index += columnCount;
    if (!chunk.some(Boolean)) continue;

    if (chunk.length === 1) {
      rows.push({ isSection: true, test: chunk[0] });
    } else {
      rows.push(...rowFromCells(chunk, columns));
    }
  }

  return rows.length ? rows : rowsFromFileName(label);
}

// ─── BUG FIX #4: parseRowsFromXlsxText handles the structured output from SheetJS ───
// SheetJS gives us clean rows and columns. We parse them directly instead of relying
// on the heuristic header-search that works for .doc but fails for spreadsheets.
function parseRowsFromXlsxText(text, label) {
  const lines = text
    .split("\n")
    .map((line) => line.split("\t").map((c) => cleanCell(c)))
    .filter((cols) => cols.some(Boolean));

  if (lines.length === 0) return rowsFromFileName(label);

  // Try to find the header row
  const headerIndex = lines.findIndex((cols) =>
    cols.some((c) => /^TEST$/i.test(c))
  );

  if (headerIndex === -1) {
    // No header found — treat each non-empty row as a test name
    return lines
      .filter((cols) => cols[0])
      .map((cols) => ({
        isSection: false,
        test: cols[0],
        result: cols[1] || "",
        units: cols[2] || "",
        normalValue: cols[3] || "",
      }));
  }

  const headerRow = lines[headerIndex];
  const columns = headerRow
    .map((cell, i) => {
      const upper = cell.toUpperCase();
      if (/^TEST$/.test(upper)) return { key: "test", label: "TEST", index: i };
      if (/^RESULT$/.test(upper)) return { key: "result", label: "RESULT", index: i };
      if (/^UNITS?$/.test(upper)) return { key: "units", label: "UNITS", index: i };
      if (/NORMAL/.test(upper)) return { key: "normalValue", label: "NORMAL VALUE", index: i };
      return null;
    })
    .filter(Boolean);

  if (columns.length < 2) return rowsFromFileName(label);

  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const cols = lines[i];
    if (!cols.some(Boolean)) continue;

    const testCol = columns.find((c) => c.key === "test");
    const resultCol = columns.find((c) => c.key === "result");
    const unitsCol = columns.find((c) => c.key === "units");
    const normalCol = columns.find((c) => c.key === "normalValue");

    const testVal = testCol ? cleanCell(cols[testCol.index]) : "";
    if (!testVal) continue;

    // Check if it's a section header (result column is empty and test spans)
    const resultVal = resultCol ? cleanCell(cols[resultCol.index]) : "";
    const isSection = !resultVal && columns.length > 1 && !cols.slice(1).some(Boolean);

    rows.push({
      isSection,
      test: testVal,
      result: resultVal,
      units: unitsCol ? cleanCell(cols[unitsCol.index]) : "",
      normalValue: normalCol ? cleanCell(cols[normalCol.index]) : "",
    });
  }

  return rows.length ? rows : rowsFromFileName(label);
}

const CUSTOM_TEMPLATES = {
  "blood cbc.docx": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "C/E.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Haemoglobin", result: "", units: "gms/100ml", normalValue: "Male.14 – 18\nFemale .12 – 16" },
      { isSection: false, test: "Total R.B.Cs.", result: "", units: "Million/Cmm", normalValue: "Male. 4.5 – 5.5\nFemale. 3.5 – 4.5" },
      { isSection: false, test: "Total Leucocytes Count. (TLC)", result: "", units: "Cmm", normalValue: "4000 – 11000" },
      { isSection: true, test: "Diff.Leucocytes. Count (DLC)" },
      { isSection: false, test: "Neutrophils", result: "", units: "%", normalValue: "55 – 70" },
      { isSection: false, test: "Lymphocytes", result: "", units: "%", normalValue: "25 – 40" },
      { isSection: false, test: "Monocytes", result: "", units: "%", normalValue: "02 – 07" },
      { isSection: false, test: "Eosinophils", result: "", units: "%", normalValue: "01 – 05" },
      { isSection: false, test: "Basophils", result: "", units: "%", normalValue: "00 – 01" },
      { isSection: false, test: "E.S.R. (Westergren)", result: "", units: "mm. in 1st hour", normalValue: "Male. 1 – 10\nFemale. 1 – 15" },
      { isSection: false, test: "Platelets Count", result: "", units: "Cmm", normalValue: "150,000 – 450,000" },
      { isSection: false, test: "Bleeding Time", result: "", units: "", normalValue: "1 – 5 min" },
      { isSection: false, test: "Clotting Time", result: "", units: "", normalValue: "2 – 7 min" }
    ]
  },
  "blood cbc children.docx": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "C/E.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Haemoglobin", result: "", units: "gms/100ml", normalValue: "Male.14 – 18\nFemale .12 – 16" },
      { isSection: false, test: "Total R.B.Cs.", result: "", units: "Million/Cmm", normalValue: "Male. 4.5 – 5.5\nFemale. 3.5 – 4.5" },
      { isSection: false, test: "Total Leucocytes Count. (TLC)", result: "", units: "Cmm", normalValue: "4000 – 11000" },
      { isSection: true, test: "Diff.Leucocytes. Count (DLC)" },
      { isSection: false, test: "Neutrophils", result: "", units: "%", normalValue: "25 – 40" },
      { isSection: false, test: "Lymphocytes", result: "", units: "%", normalValue: "45 – 70" },
      { isSection: false, test: "Monocytes", result: "", units: "%", normalValue: "02 – 07" },
      { isSection: false, test: "Eosinophils", result: "", units: "%", normalValue: "01 – 05" },
      { isSection: false, test: "Basophils", result: "", units: "%", normalValue: "00 – 01" },
      { isSection: false, test: "E.S.R. (Westergren)", result: "", units: "mm. in 1st hour", normalValue: "Male. 1 – 10\nFemale. 1 – 15" },
      { isSection: false, test: "Platelets Count", result: "", units: "Cmm", normalValue: "150,000 – 450,000" },
      { isSection: false, test: "Bleeding Time", result: "", units: "", normalValue: "1 – 5 min" },
      { isSection: false, test: "Clotting Time", result: "", units: "", normalValue: "2 – 7 min" }
    ]
  },
  "pt.aptt.inr.doc": {
    categoryTitle: "HAEMATOLOGY REPORT",
    specimen: "Blood",
    examRequired: "PT. APTT. INR",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: true, test: "COAGULATION PROFILE" },
      { isSection: false, test: "Prothrombin Time", result: "", units: "Sec.", normalValue: "11 - 16 Sec." },
      { isSection: false, test: "Control", result: "", units: "Sec.", normalValue: "" },
      { isSection: false, test: "APTT", result: "", units: "Sec.", normalValue: "30 - 46 Sec." },
      { isSection: false, test: "Control", result: "", units: "Sec.", normalValue: "" },
      { isSection: false, test: "INR", result: "", units: "", normalValue: "" },
      { isSection: true, test: "Note: Oral anticoagulant therapeutic range = 2.0 - 3.5" }
    ]
  },
  "pt.i.n.r.doc": {
    categoryTitle: "COAGULATION REPORT",
    specimen: "Blood",
    examRequired: "PT. I.N.R.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Control", result: "", units: "Sec", normalValue: "12 - 16 Sec" },
      { isSection: false, test: "Patient PT", result: "", units: "Sec", normalValue: "12 - 16 Sec" },
      { isSection: false, test: "I.N.R", result: "", units: "", normalValue: "" }
    ]
  },
  "s.bilirubin.b.c.doc": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "S.Bilirubin. HBsAg. Anti HCV.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Serum Bilirubin(Total)", result: "", units: "mg/dl", normalValue: "0.1 - 1.0" },
      { isSection: false, test: "Hepatitis B Virus. ( HBsAg ) By (I.C.T)", result: "", units: "", normalValue: "", newTable: true, tableColumns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }] },
      { isSection: false, test: "Hepatitis C Virus. ( Anti HCV ) By (I.C.T)", result: "", units: "", normalValue: "", newTable: true, tableColumns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }] },
      { isSection: true, test: "COMMENTS:-\nHBsAg & Anti HCV tests are performed by an immunochromatographic screening method. The technique has sensitivity of 99% and specificity of 98%.Clinically inconsistent results should be reconfirmed by an alternative method (e.g. EIA)." }
    ]
  },
  "semen .doc": {
    categoryTitle: "SEMEN ANALYSIS REPORT",
    specimen: "Semen",
    examRequired: "C/E",
    columns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }],
    rows: [
      { isSection: true, test: "PHYSICAL EXAMINATION" },
      { isSection: false, test: "Quantity", result: "" },
      { isSection: false, test: "Reaction", result: "" },
      { isSection: false, test: "Consistency", result: "" },
      { isSection: false, test: "Time", result: "" },
      { isSection: true, test: "MICROSCOPIC EXAMINATION" },
      { isSection: false, test: "1. Active motile", result: "" },
      { isSection: false, test: "2. Sluggish", result: "" },
      { isSection: false, test: "3. Dead", result: "" },
      { isSection: false, test: "4. Pus cells", result: "" },
      { isSection: false, test: "5. Epith Cells", result: "" },
      { isSection: false, test: "6. Total Count", result: "" },
      { isSection: false, test: "Normal Value", result: "50 - 150 million/ml" }
    ]
  },
  "semen 2.doc": {
    categoryTitle: "SEMEN ANALYSIS REPORT",
    specimen: "Semen",
    examRequired: "C/E.",
    columns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }],
    rows: [
      { isSection: true, test: "PHYSICAL EXAMINATION" },
      { isSection: false, test: "Quantity", result: "" },
      { isSection: false, test: "Reaction", result: "" },
      { isSection: false, test: "Consistency", result: "" },
      { isSection: false, test: "Time", result: "" },
      { isSection: true, test: "MICROSCOPIC EXAMINATION (After 30 Minutes)" },
      { isSection: false, test: "1. Active motile", result: "" },
      { isSection: false, test: "2. Sluggish", result: "" },
      { isSection: false, test: "3. Dead", result: "" },
      { isSection: false, test: "4. Pus cells", result: "" },
      { isSection: false, test: "5. Epith Cells", result: "" },
      { isSection: false, test: "6. Total Count", result: "" },
      { isSection: false, test: "Normal Value", result: "50 - 150 million/ml" }
    ]
  },
  "shafi center.doc": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "Hb%. Grouping. HBsAg. Anti HCV.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Haemoglobin", result: "", units: "gms/100ml", normalValue: "Male. 14 - 18\nFemale . 12 - 16" },
      { isSection: false, test: "Blood Grouping & Rh. Factor", result: "", units: "", normalValue: "" },
      { isSection: false, test: "Hepatitis B virus ( HBsAg ) By (I.C.T)", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: false, test: "Anti HCV ( Hepatitis C virus ) By (I.C.T)", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: true, test: "COMMENTS:\nHBsAg & Anti HCV tests are performed by an immunochromatographic screening method. The technique has sensitivity of 99% and specificity of 98%.Clinically inconsistent results should be reconfirmed by an alternative method (e.g. EIA)." }
    ]
  },
  "shafi center2.doc": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "Hb%. Grouping. HBsAg. Anti HCV. Glucose.",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Haemoglobin", result: "", units: "gms/100ml", normalValue: "Male. 14 - 18\nFemale . 12 - 16" },
      { isSection: false, test: "Glucose. (Random)", result: "", units: "mg/dl", normalValue: "80 - 160" },
      { isSection: false, test: "Blood Grouping & Rh. Factor", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: false, test: "Hepatitis B virus ( HBsAg ) By (I.C.T)", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: false, test: "Anti HCV ( Hepatitis C virus ) By (I.C.T)", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: true, test: "COMMENTS:\nHBsAg & Anti HCV tests are performed by an immunochromatographic screening method. The technique has sensitivity of 99% and specificity of 98%.Clinically inconsistent results should be reconfirmed by an alternative method (e.g. EIA)." }
    ]
  },
  "stool c.p.doc": {
    categoryTitle: "STOOL EXAMINATION REPORT",
    specimen: "Stool",
    examRequired: "C/E.",
    columns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }],
    rows: [
      { isSection: true, test: "PHYSICAL EXAMINATION" },
      { isSection: false, test: "Colour", result: "" },
      { isSection: false, test: "Consistancy", result: "" },
      { isSection: false, test: "Mucus", result: "" },
      { isSection: true, test: "MICROSCOPIC EXAMINATION" },
      { isSection: false, test: "Pus Cells", result: "" },
      { isSection: false, test: "RBCs", result: "" },
      { isSection: false, test: "Ova & Cyst", result: "" },
      { isSection: false, test: "Others", result: "" }
    ]
  },
  "stool cp.doc": {
    categoryTitle: "STOOL EXAMINATION REPORT",
    specimen: "Stool",
    examRequired: "C/E.",
    columns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }],
    rows: [
      { isSection: true, test: "PHYSICAL EXAMINATION" },
      { isSection: false, test: "Colour", result: "" },
      { isSection: false, test: "Consistency", result: "" },
      { isSection: false, test: "Mucus", result: "" },
      { isSection: false, test: "Occult Blood", result: "" },
      { isSection: true, test: "MICROSCOPIC EXAMINATION" },
      { isSection: false, test: "( 1 ). Ova and cyst", result: "" },
      { isSection: false, test: "( 2 ). Pus cells", result: "" }
    ]
  },
  "uric acid.r.a.facter.doc": {
    categoryTitle: "LABORATORY REPORT",
    specimen: "Blood",
    examRequired: "Serum Uric Acid. R.A. Factor.Glucose",
    columns: DEFAULT_COLUMNS,
    rows: [
      { isSection: false, test: "Serum Uric Acid", result: "", units: "mg/dl", normalValue: "Male. 3.4 - 7.0\nFemale. 2.4 - 5.7" },
      { isSection: false, test: "Serum Rheumatoid Arthritis Factor.", result: "", units: "", normalValue: "", isTwoCol: true },
      { isSection: false, test: "Glucose. (Random)", result: "", units: "mg/dl", normalValue: "80 - 160" }
    ]
  },
  "urine cp.doc": {
    categoryTitle: "ROUTINE URINE EXAMINATION",
    specimen: "Urine",
    examRequired: "C/E",
    columns: [{ key: "test", label: "TEST" }, { key: "result", label: "RESULT" }],
    rows: [
      { isSection: true, test: "PHYSICAL EXAMINATION" },
      { isSection: false, test: "Volume", result: "" },
      { isSection: false, test: "Appearance", result: "" },
      { isSection: false, test: "Colour", result: "" },
      { isSection: false, test: "Deposit", result: "" },
      { isSection: true, test: "CHEMICAL EXAMINATION" },
      { isSection: false, test: "Reaction (PH)", result: "" },
      { isSection: false, test: "Bile Salt", result: "" },
      { isSection: false, test: "Albumin", result: "" },
      { isSection: false, test: "Bilirubin", result: "" },
      { isSection: false, test: "Sugar", result: "" },
      { isSection: false, test: "Urobilinogen", result: "" },
      { isSection: false, test: "Ketones", result: "" },
      { isSection: true, test: "MICROSCOPIC EXAMINATION" },
      { isSection: false, test: "Pus Cells", result: "" },
      { isSection: false, test: "R.B.Cs", result: "" },
      { isSection: false, test: "Epith. Cells", result: "" },
      { isSection: false, test: "Casts", result: "" },
      { isSection: false, test: "Crystal", result: "" },
      { isSection: false, test: "Bacteria", result: "" },
      { isSection: false, test: "Leukocytes", result: "" }
    ]
  }
};

async function buildTemplate(fileName) {
  const filePath = path.join(REPORTS_DIR, fileName);
  const label = labelFromFileName(fileName);
  const ext = path.extname(fileName).toLowerCase();

  const overrideKey = fileName.toLowerCase();
  if (CUSTOM_TEMPLATES[overrideKey]) {
    const custom = CUSTOM_TEMPLATES[overrideKey];
    return {
      key: fileName,
      label,
      fileName,
      fileUrl: `/reports/${encodeURIComponent(fileName)}`,
      specimen: custom.specimen,
      examRequired: custom.examRequired,
      categoryTitle: custom.categoryTitle,
      columns: custom.columns,
      rows: custom.rows,
    };
  }

  // BUG FIX #5: Use proper per-format extraction instead of one-size-fits-all binary read
  const text = await extractTextFromFile(filePath, ext);
  const metadata = getMetadata(text, label);

  let columns = DEFAULT_COLUMNS;
  let rows;

  if (ext === ".xlsx" || ext === ".xls") {
    // For spreadsheets, use the structured xlsx parser
    rows = parseRowsFromXlsxText(text, label);
    const { columns: detectedColumns } = getTableParts(text);
    columns = detectedColumns;
  } else {
    // For .doc/.docx, use the text-based table parser
    const { columns: detectedColumns } = getTableParts(text);
    columns = detectedColumns;
    rows = parseRows(text, label, columns);
  }

  return {
    key: fileName,
    label,
    fileName,
    fileUrl: `/reports/${encodeURIComponent(fileName)}`,
    ...metadata,
    columns,
    rows,
  };
}

export async function GET() {
  try {
    const fileNames = (await readdir(REPORTS_DIR))
      .filter(isReportTemplateFile)
      .sort((a, b) => a.localeCompare(b));

    const templates = await Promise.all(fileNames.map(buildTemplate));
    return NextResponse.json({ templates });
  } catch (error) {
    console.error("GET /api/report-templates error:", error);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}