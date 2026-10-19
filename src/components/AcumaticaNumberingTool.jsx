import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, FileUp, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import {
  DEFAULT_NUMBERING_CATEGORIES,
  categoryKey,
  generateNumberingRows,
  generateSummaryRows,
  migrateLegacyCategories,
  normalizeCategory,
  parseBranches,
  parseYears,
  validateCategory,
} from "../lib/acumatica-numbering";

const STORAGE_KEY = "assistand-help.acumatica-numbering-categories.v3";
const PREVIOUS_STORAGE_KEYS = [
  "assistand-help.acumatica-numbering-categories.v2",
  "assistand-help.acumatica-numbering-categories.v1",
];
const OUTPUT_HEADERS = ["Branch", "Start Number", "End Number", "Start Date", "Last Number", "Warning Number", "Numbering Step", "Numbering ID"];
const SUMMARY_HEADERS = OUTPUT_HEADERS.filter((header) => header !== "Numbering ID");
const OUTPUT_PAGE_SIZE = 100;

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved.map((item) => normalizeCategory(item));
    for (const key of PREVIOUS_STORAGE_KEYS) {
      const previous = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(previous)) return migrateLegacyCategories(previous);
    }
  } catch { /* Fall back to defaults when saved data is malformed. */ }
  return DEFAULT_NUMBERING_CATEGORIES;
}

function createStyledWorksheet(rows, headers) {
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  const thinBorder = {
    bottom: { color: { rgb: "D1D5DB" }, style: "thin" },
    left: { color: { rgb: "D1D5DB" }, style: "thin" },
    right: { color: { rgb: "D1D5DB" }, style: "thin" },
    top: { color: { rgb: "D1D5DB" }, style: "thin" },
  };

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = worksheet[address];
      if (!cell) continue;
      cell.s = row === 0
        ? {
          alignment: { horizontal: "left", vertical: "center" },
          border: thinBorder,
          fill: { fgColor: { rgb: "000066" }, patternType: "solid" },
          font: { bold: true, color: { rgb: "FFFFFF" } },
        }
        : {
          alignment: {
            horizontal: headers[column] === "Start Date" ? "center" : headers[column] === "Numbering Step" ? "right" : "left",
            vertical: "center",
          },
          border: thinBorder,
          fill: { fgColor: { rgb: "FFFFFF" }, patternType: "solid" },
          font: { color: { rgb: "000000" } },
        };
    }
  }

  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  worksheet["!rows"] = Array.from({ length: range.e.r + 1 }, (_, index) => ({ hpt: index === 0 ? 22 : 18 }));
  worksheet["!cols"] = headers.map((header) => {
    const longestValue = rows.reduce((longest, row) => Math.max(longest, String(row[header] ?? "").length), header.length);
    return { wch: Math.min(Math.max(longestValue + 3, 12), 28) };
  });
  return worksheet;
}

function downloadWorkbook(rows, filename, sheetName, headers) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, createStyledWorksheet(rows, headers), sheetName);
  XLSX.writeFile(workbook, filename);
}

function getNumberingSheetName(rows) {
  const years = [...new Set(rows.map((row) => String(row["Start Date"] || "").slice(-4)).filter(Boolean))].sort();
  if (!years.length) return "Numbering";
  const yearLabel = years.length === 1 ? years[0] : `${years[0]}-${years.at(-1)}`;
  return `Numbering ${yearLabel}`;
}

function downloadNumberingWorkbook(rows, summaryRows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, createStyledWorksheet(rows, OUTPUT_HEADERS), getNumberingSheetName(rows));
  XLSX.utils.book_append_sheet(workbook, createStyledWorksheet(summaryRows, SUMMARY_HEADERS), "Summary");
  XLSX.writeFile(workbook, "acumatica-numbering-system.xlsx");
}

function CategoryModal({ initial, onClose, onSave }) {
  const [draft, setDraft] = useState(initial || { code: "", numberingId: "", enabled: true });
  const [error, setError] = useState("");
  function submit(event) {
    event.preventDefault();
    const normalized = normalizeCategory(draft, initial?.id);
    const message = validateCategory(normalized);
    if (message) return setError(message);
    const saveError = onSave(normalized);
    if (saveError) setError(saveError);
  }
  return (
    <div className="numbering-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="numbering-modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p className="eyebrow">Manage Categories</p><h2>{initial ? "Edit Category" : "Add Category"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        <label>Numbering Code<input autoFocus value={draft.code} maxLength={10} placeholder="AP" onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></label>
        <label>Numbering ID<input value={draft.numberingId} maxLength={10} placeholder="APBILL" onChange={(e) => setDraft({ ...draft, numberingId: e.target.value.toUpperCase() })} /></label>
        <label className="numbering-check"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Enabled</label>
        {error ? <p className="numbering-error" role="alert">{error}</p> : null}
        <footer><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button" type="submit">Save Category</button></footer>
      </form>
    </div>
  );
}

export default function AcumaticaNumberingTool() {
  const [categories, setCategories] = useState(loadCategories);
  const [branchesInput, setBranchesInput] = useState("");
  const [yearsInput, setYearsInput] = useState("2027-2028");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState(undefined);
  const [rows, setRows] = useState([]);
  const [summaryRows, setSummaryRows] = useState([]);
  const [outputPage, setOutputPage] = useState(1);
  const [message, setMessage] = useState("");
  const importRef = useRef(null);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(categories)); }, [categories]);
  const filtered = useMemo(() => categories.filter((item) => {
    const matchesText = `${item.code} ${item.numberingId}`.toLowerCase().includes(query.toLowerCase());
    return matchesText && (statusFilter === "all" || (statusFilter === "enabled") === item.enabled);
  }), [categories, query, statusFilter]);
  const outputPageCount = Math.max(1, Math.ceil(rows.length / OUTPUT_PAGE_SIZE));
  const outputPageRows = rows.slice((outputPage - 1) * OUTPUT_PAGE_SIZE, outputPage * OUTPUT_PAGE_SIZE);
  const previewBranchId = branchesInput.trim().toUpperCase().split(/[,;\s]+/)[0] || "BranchID";

  function saveCategory(category) {
    const duplicate = categories.some((item) => item.id !== category.id && categoryKey(item) === categoryKey(category));
    if (duplicate) return "A category with the same Numbering Code and Numbering ID already exists.";
    setCategories((items) => category.id && items.some((item) => item.id === category.id) ? items.map((item) => item.id === category.id ? category : item) : [...items, category]);
    setModalCategory(undefined);
    setMessage(`Category ${category.code} / ${category.numberingId} saved.`);
    return "";
  }

  function removeCategory(category) {
    if (!window.confirm(`Delete ${category.code} / ${category.numberingId}? This cannot be undone.`)) return;
    setCategories((items) => items.filter((item) => item.id !== category.id));
    setMessage("Category deleted.");
  }

  function setAll(enabled) {
    setCategories((items) => items.map((item) => ({ ...item, enabled })));
    setMessage(enabled ? "All categories enabled." : "All categories disabled.");
  }

  async function importCategories(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const imported = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" }).map((item) => normalizeCategory(item));
      if (!imported.length) throw new Error("The file does not contain any category rows.");
      const invalid = imported.map((item) => validateCategory(item)).find(Boolean);
      if (invalid) throw new Error(invalid);
      const existingKeys = new Set(categories.map(categoryKey));
      const importedKeys = new Set();
      const duplicate = imported.find((item) => existingKeys.has(categoryKey(item)) || importedKeys.has(categoryKey(item)) || !importedKeys.add(categoryKey(item)));
      if (duplicate) throw new Error(`Import stopped: ${duplicate.code} / ${duplicate.numberingId} already exists. No categories were overwritten.`);
      setCategories((items) => [...items, ...imported]);
      setMessage(`${imported.length} categor${imported.length === 1 ? "y" : "ies"} imported.`);
    } catch (error) { setMessage(error.message || "Could not import this file."); }
  }

  function generate() {
    try {
      const enabled = categories.filter((item) => item.enabled);
      if (!enabled.length) throw new Error("Enable at least one category before generating.");
      const branches = parseBranches(branchesInput);
      const years = parseYears(yearsInput);
      const generated = generateNumberingRows(branches, years, enabled);
      setRows(generated);
      setSummaryRows(generateSummaryRows(branches, years));
      setOutputPage(1);
      setMessage(`${generated.length} unique numbering row${generated.length === 1 ? "" : "s"} generated.`);
    } catch (error) { setRows([]); setSummaryRows([]); setOutputPage(1); setMessage(error.message); }
  }

  return (
    <section className="numbering-tool">
      <header className="numbering-hero"><div><p className="eyebrow">Acumatica</p><h1>Numbering System Generator</h1><p>Generate import-ready numbering sequences for every branch, year, and enabled category.</p></div><span>Step fixed at 1</span></header>
      <div className="numbering-generator-card">
        <div className="numbering-inputs"><label>BranchID <span>Separate multiple Branch IDs with commas or spaces</span><input value={branchesInput} onChange={(e) => setBranchesInput(e.target.value.toUpperCase())} placeholder="BranchID" /></label><label>Years <span>Range or comma-separated</span><input value={yearsInput} onChange={(e) => setYearsInput(e.target.value)} placeholder="2027-2028 or 2027, 2028" /></label><button className="button" type="button" onClick={generate}>Generate Numbering</button></div>
        {message ? <p className="numbering-message" role="status">{message}</p> : null}
      </div>

      <section className="numbering-section">
        <div className={`numbering-section-heading${categoryManagerOpen ? "" : " is-collapsed"}`}><div><p className="eyebrow">Configuration</p><h2>Manage Categories</h2><p>{categories.filter((item) => item.enabled).length} of {categories.length} enabled</p></div><button className="button secondary" type="button" aria-expanded={categoryManagerOpen} aria-controls="numbering-category-manager" onClick={() => setCategoryManagerOpen((open) => !open)}>{categoryManagerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}{categoryManagerOpen ? "Hide Categories" : "Show Categories"}</button></div>
        {categoryManagerOpen ? <div id="numbering-category-manager"><div className="numbering-actions numbering-category-actions"><button className="button secondary" onClick={() => importRef.current?.click()}><FileUp size={16} /> Import</button><button className="button secondary" onClick={() => downloadWorkbook(categories.map(({ code, numberingId, enabled }) => ({ "Numbering Code": code, "Numbering ID": numberingId, Enabled: enabled ? "Enabled" : "Disabled" })), "acumatica-numbering-categories.xlsx", "Categories", ["Numbering Code", "Numbering ID", "Enabled"])}><Download size={16} /> Export</button><button className="button" onClick={() => setModalCategory(null)}><Plus size={16} /> Add Category</button><input ref={importRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={importCategories} /></div><div className="numbering-toolbar"><label className="numbering-search"><Search size={17} /><input aria-label="Search categories" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or Numbering ID" /></label><select aria-label="Filter categories" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">All categories</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select><button className="button ghost" onClick={() => setAll(true)}>Select All</button><button className="button ghost" onClick={() => setAll(false)}>Deselect All</button></div><div className="numbering-table-wrap"><table className="numbering-table"><thead><tr><th>Status</th><th>Code</th><th>Numbering ID</th><th>Preview (2027)</th><th>Actions</th></tr></thead><tbody>{filtered.map((category) => <tr key={category.id}><td><label className="numbering-switch"><input type="checkbox" checked={category.enabled} onChange={(e) => setCategories((items) => items.map((item) => item.id === category.id ? { ...item, enabled: e.target.checked } : item))} /><span>{category.enabled ? "Enabled" : "Disabled"}</span></label></td><td><strong>{category.code}</strong></td><td>{category.numberingId}</td><td><code>{previewBranchId}-{category.code}27000000</code></td><td><div className="numbering-row-actions"><button onClick={() => setModalCategory(category)} aria-label={`Edit ${category.code}`}><Pencil size={16} /></button><button className="danger" onClick={() => removeCategory(category)} aria-label={`Delete ${category.code}`}><Trash2 size={16} /></button></div></td></tr>)}{!filtered.length ? <tr><td colSpan="5" className="numbering-empty">No categories match this filter.</td></tr> : null}</tbody></table></div></div> : null}
      </section>

      <section className="numbering-section">
        <div className="numbering-section-heading"><div><p className="eyebrow">Output</p><h2>Generated Numbering</h2><p>{rows.length ? `${rows.length} rows ready to export` : "Generate rows to preview them here"}</p></div><button className="button secondary" disabled={!rows.length} onClick={() => downloadNumberingWorkbook(rows, summaryRows)}><Download size={16} /> Export Excel</button></div>
        <div className="numbering-table-wrap"><table className="numbering-table numbering-output-table"><thead><tr>{OUTPUT_HEADERS.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{outputPageRows.map((row) => <tr key={`${row.Branch}-${row["Start Date"]}-${row["Numbering ID"]}-${row["Start Number"]}`}>{OUTPUT_HEADERS.map((header) => <td key={header}>{row[header]}</td>)}</tr>)}{!rows.length ? <tr><td colSpan={OUTPUT_HEADERS.length} className="numbering-empty">No numbering rows generated yet.</td></tr> : null}</tbody></table></div>
        {rows.length ? <div className="numbering-pagination"><p>Showing {(outputPage - 1) * OUTPUT_PAGE_SIZE + 1}-{Math.min(outputPage * OUTPUT_PAGE_SIZE, rows.length)} of {rows.length}. Excel export includes all rows.</p><div><button className="button ghost" type="button" disabled={outputPage === 1} onClick={() => setOutputPage((page) => page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page {outputPage} of {outputPageCount}</span><button className="button ghost" type="button" disabled={outputPage === outputPageCount} onClick={() => setOutputPage((page) => page + 1)}>Next <ChevronRight size={16} /></button></div></div> : null}
      </section>
      {modalCategory !== undefined ? <CategoryModal initial={modalCategory} onClose={() => setModalCategory(undefined)} onSave={saveCategory} /> : null}
    </section>
  );
}
