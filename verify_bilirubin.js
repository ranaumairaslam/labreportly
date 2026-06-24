const { readdir, readFile } = require("fs/promises");
const path = require("path");

const REPORTS_DIR = path.join(process.cwd(), "public", "reports");
const DEFAULT_COLUMNS = [
  { key: "test", label: "TEST" },
  { key: "result", label: "RESULT" },
  { key: "units", label: "UNITS" },
  { key: "normalValue", label: "NORMAL VALUE" },
];

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

async function extractTextFromDoc(buffer) {
  return new TextDecoder("windows-1252").decode(buffer);
}

async function extractTextFromFile(filePath, ext) {
  const buffer = await readFile(filePath);
  return extractTextFromDoc(buffer);
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
    specimen: cleanCell(specimenMatch?.[1]) || "Blood",
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

function parseRows(text, label, columns) {
  const { tableText } = getTableParts(text);
  if (!tableText) return rowsFromFileName(label);

  const rows = [];
  const columnCount = columns.length;

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

async function buildTemplate(fileName) {
  const filePath = path.join(REPORTS_DIR, fileName);
  const label = labelFromFileName(fileName);
  const ext = path.extname(fileName).toLowerCase();

  const text = await extractTextFromFile(filePath, ext);
  const metadata = getMetadata(text, label);

  let columns = DEFAULT_COLUMNS;
  let rows;

  const { columns: detectedColumns } = getTableParts(text);
  columns = detectedColumns;
  rows = parseRows(text, label, columns);

  return {
    key: fileName,
    label,
    fileName,
    ...metadata,
    columns,
    rows,
  };
}

async function run() {
  const t = await buildTemplate("Direct Bilirubin. Indirect Bilirubin. .doc");
  console.log("=== Direct Bilirubin. Indirect Bilirubin. ===");
  console.log(JSON.stringify(t, null, 2));
}

run();
