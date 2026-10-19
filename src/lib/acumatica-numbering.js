export const DEFAULT_NUMBERING_CATEGORIES = [
  ["AP", "APBILL"],
  ["AR", "ARINVOICE"],
  ["CR", "CARECON"],
  ["CT", "CATRANSFER"],
  ["DO", "SOSHIPMENT"],
  ["GL", "BATCH"],
  ["IR", "INRECEIPT"],
  ["IS", "INISSUE"],
  ["JE", "JEBATCH"],
  ["JV", "JVADJUST"],
  ["LC", "POLANDCOST"],
  ["PM", "APPAYMENT"],
  ["PMO", "PAYMENTORD"],
  ["PO", "POORDER"],
  ["PR", "PORECEIPT"],
  ["RC", "ARPAYMENT"],
  ["RN", "RQITEM"],
  ["RQ", "RQREQUISIT"],
  ["RS", "INREQREF"],
  ["SO", "SOORDER"],
].map(([code, numberingId]) => ({
  id: `${code.toLowerCase()}-${numberingId.toLowerCase()}`,
  code,
  numberingId,
  enabled: true,
}));

export function migrateLegacyCategories(savedCategories) {
  const normalized = Array.isArray(savedCategories)
    ? savedCategories.map((item) => normalizeCategory(item))
    : [];
  const savedByKey = new Map(normalized.map((item) => [categoryKey(item), item]));
  const requiredKeys = new Set(DEFAULT_NUMBERING_CATEGORIES.map(categoryKey));
  const required = DEFAULT_NUMBERING_CATEGORIES.map((item) => {
    const saved = savedByKey.get(categoryKey(item));
    if (!saved) return item;
    return {
      ...item,
      enabled: saved.enabled,
    };
  });
  const retiredKeys = new Set(["PI\u0000PIID", "CM\u0000CATRAN"]);
  const custom = normalized.filter((item) => !requiredKeys.has(categoryKey(item)) && !retiredKeys.has(categoryKey(item)));
  return [...required, ...custom];
}

const CODE_PATTERN = /^[A-Z0-9]{1,10}$/;
const NUMBERING_CODE_PATTERN = /^[A-Z0-9]{1,7}$/;
const BRANCH_PATTERN = /^[A-Z0-9]{1,7}$/;

export function normalizeCategory(category, fallbackId = crypto.randomUUID()) {
  return {
    id: String(category.id || fallbackId),
    code: String(category.code ?? category["Numbering Code"] ?? "").trim().toUpperCase(),
    numberingId: String(category.numberingId ?? category["Numbering ID"] ?? "").trim().toUpperCase(),
    enabled: parseEnabled(category.enabled ?? category.Enabled ?? category.Status),
  };
}

export function parseEnabled(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return true;
  return !["false", "disabled", "no", "0", "inactive"].includes(String(value).trim().toLowerCase());
}

export function validateCategory(category) {
  if (!NUMBERING_CODE_PATTERN.test(category.code)) return "Numbering Code must contain 1-7 letters or numbers.";
  if (!CODE_PATTERN.test(category.numberingId)) return "Numbering ID must contain 1-10 letters or numbers.";
  return "";
}

export function categoryKey(category) {
  return `${category.code}\u0000${category.numberingId}`;
}

export function parseBranches(value) {
  const branches = uniqueTokens(value);
  const invalid = branches.filter((branch) => !BRANCH_PATTERN.test(branch));
  if (!branches.length) throw new Error("Enter at least one Branch code.");
  if (invalid.length) throw new Error(`Invalid BranchID${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}. Use 1-7 letters or numbers.`);
  return branches;
}

export function parseYears(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("Enter at least one year.");
  const years = [];
  for (const part of input.split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean)) {
    const range = part.match(/^(\d{4})\s*-\s*(\d{4})$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (end < start || end - start > 99) throw new Error(`Invalid year range: ${part}.`);
      for (let year = start; year <= end; year += 1) years.push(year);
    } else if (/^\d{4}$/.test(part)) {
      years.push(Number(part));
    } else {
      throw new Error(`Invalid year value: ${part}. Use 2027-2028 or 2027, 2028.`);
    }
  }
  const result = [...new Set(years)];
  if (result.some((year) => year < 2000 || year > 2099)) throw new Error("Years must be between 2000 and 2099.");
  return result.sort((a, b) => a - b);
}

function uniqueTokens(value) {
  return [...new Set(String(value || "").split(/[,;\s]+/).map((item) => item.trim().toUpperCase()).filter(Boolean))];
}

export function generateNumberingRows(branches, years, categories) {
  const rows = [];
  const seen = new Set();
  for (const branch of branches) {
    for (const year of years) {
      const suffix = String(year).slice(-2);
      for (const category of categories.filter((item) => item.enabled)) {
        const prefix = `${branch}-${category.code}${suffix}`;
        const sequenceWidth = 8 - category.code.length;
        const row = {
          Branch: branch,
          "Start Number": `${prefix}${"0".repeat(sequenceWidth)}`,
          "End Number": `${prefix}${"9".repeat(sequenceWidth)}`,
          "Start Date": `01-01-${year}`,
          "Last Number": `${prefix}${"0".repeat(sequenceWidth)}`,
          "Warning Number": `${prefix}${"9".repeat(sequenceWidth - 1)}0`,
          "Numbering Step": 1,
          "Numbering ID": category.numberingId,
        };
        const key = `${branch}|${year}|${categoryKey(category)}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push(row);
        }
      }
    }
  }
  return rows;
}

export function generateSummaryRows(branches, years) {
  return branches.flatMap((branch) => years.map((year) => {
    const prefix = `${branch}${String(year).slice(-2)}`;
    const sequenceWidth = 8 - branch.length;
    return {
      Branch: branch,
      "Start Number": `${prefix}${"0".repeat(sequenceWidth)}`,
      "End Number": `${prefix}${"9".repeat(sequenceWidth)}`,
      "Start Date": `01-01-${year}`,
      "Last Number": `${prefix}${"0".repeat(sequenceWidth)}`,
      "Warning Number": `${prefix}${"9".repeat(sequenceWidth - 1)}0`,
      "Numbering Step": 1,
    };
  }));
}
