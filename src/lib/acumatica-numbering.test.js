import test from "node:test";
import assert from "node:assert/strict";
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
} from "./acumatica-numbering.js";

const EXPECTED_MAPPINGS = [
  ["AP", "APBILL"], ["AR", "ARINVOICE"], ["CR", "CARECON"],
  ["CT", "CATRANSFER"], ["DO", "SOSHIPMENT"], ["GL", "BATCH"], ["IR", "INRECEIPT"],
  ["IS", "INISSUE"], ["JE", "JEBATCH"], ["JV", "JVADJUST"], ["LC", "POLANDCOST"],
  ["PM", "APPAYMENT"], ["PMO", "PAYMENTORD"], ["PO", "POORDER"],
  ["PR", "PORECEIPT"], ["RC", "ARPAYMENT"], ["RN", "RQITEM"], ["RQ", "RQREQUISIT"],
  ["RS", "INREQREF"], ["SO", "SOORDER"],
];

test("provides the default mappings without PIID or CATRAN", () => {
  assert.deepEqual(DEFAULT_NUMBERING_CATEGORIES.map(({ code, numberingId }) => [code, numberingId]), EXPECTED_MAPPINGS);
  assert.equal(DEFAULT_NUMBERING_CATEGORIES.length, 20);
  assert.ok(DEFAULT_NUMBERING_CATEGORIES.every((item) => !("description" in item) && item.enabled));
});

test("migrates legacy defaults while retaining custom categories and status", () => {
  const migrated = migrateLegacyCategories([
    { id: "ap-apbill", code: "AP", numberingId: "APBILL", description: "Accounts Payable bills", enabled: false },
    { id: "pi-piid", code: "PI", numberingId: "PIID", enabled: true },
    { id: "cm-catran", code: "CM", numberingId: "CATRAN", enabled: true },
    { id: "custom", code: "ZZ", numberingId: "CUSTOM", enabled: true },
  ]);
  assert.equal(migrated.length, 21);
  assert.deepEqual(migrated[0], { id: "ap-apbill", code: "AP", numberingId: "APBILL", enabled: false });
  assert.ok(migrated.some((item) => item.code === "ZZ" && item.numberingId === "CUSTOM"));
  assert.ok(!migrated.some((item) => item.code === "PI" && item.numberingId === "PIID"));
  assert.ok(!migrated.some((item) => item.code === "CM" && item.numberingId === "CATRAN"));
});

test("parses branch lists and inclusive year ranges without duplicates", () => {
  assert.deepEqual(parseBranches("AP, pp AP"), ["AP", "PP"]);
  assert.deepEqual(parseYears("2027-2028, 2028, 2029"), [2027, 2028, 2029]);
});

test("generates exact Acumatica numbering format for every combination", () => {
  const categories = [
    { code: "AP", numberingId: "APBILL", enabled: true },
    { code: "AR", numberingId: "ARINVOICE", enabled: true },
    { code: "OFF", numberingId: "OFF", enabled: false },
  ];
  const rows = generateNumberingRows(["AP", "PP"], [2027, 2028], categories);
  assert.equal(rows.length, 8);
  assert.deepEqual(rows[0], {
    Branch: "AP",
    "Start Number": "AP-AP27000000",
    "End Number": "AP-AP27999999",
    "Start Date": "01-01-2027",
    "Last Number": "AP-AP27000000",
    "Warning Number": "AP-AP27999990",
    "Numbering Step": 1,
    "Numbering ID": "APBILL",
  });
  assert.equal(rows.at(-1)["Start Number"], "PP-AR28000000");
});

test("keeps the numbering portion after the hyphen at 10 characters", () => {
  const rows = generateNumberingRows(["AL", "SDCC"], [2027], [{ code: "PMO", numberingId: "PAYMENTORD", enabled: true }]);
  assert.equal(rows[0]["Start Number"], "AL-PMO2700000");
  assert.equal(rows[0]["End Number"], "AL-PMO2799999");
  assert.equal(rows[0]["Warning Number"], "AL-PMO2799990");
  assert.equal(rows[0]["Start Number"].length, 13);
  assert.equal(rows[1]["Start Number"].length, 15);
});

test("generates one summary row per branch and year without a numbering ID", () => {
  const rows = generateSummaryRows(["AL", "SCAB"], [2027]);
  assert.deepEqual(rows, [
    { Branch: "AL", "Start Number": "AL27000000", "End Number": "AL27999999", "Start Date": "01-01-2027", "Last Number": "AL27000000", "Warning Number": "AL27999990", "Numbering Step": 1 },
    { Branch: "SCAB", "Start Number": "SCAB270000", "End Number": "SCAB279999", "Start Date": "01-01-2027", "Last Number": "SCAB270000", "Warning Number": "SCAB279990", "Numbering Step": 1 },
  ]);
  assert.ok(rows.every((row) => row["Start Number"].length === 10));
  assert.ok(rows.every((row) => !("Numbering ID" in row)));
});

test("normalizes imported category columns and validates category keys", () => {
  const category = normalizeCategory({ "Numbering Code": " cm ", "Numbering ID": " catran ", Enabled: "Disabled" }, "row-1");
  assert.deepEqual(category, { id: "row-1", code: "CM", numberingId: "CATRAN", enabled: false });
  assert.equal(categoryKey(category), "CM\u0000CATRAN");
  assert.equal(validateCategory(category), "");
  assert.match(validateCategory({ code: "BAD CODE", numberingId: "OK" }), /Numbering Code/);
});

test("rejects invalid branches and years", () => {
  assert.throws(() => parseBranches("AP-$"), /Invalid Branch/);
  assert.throws(() => parseYears("2028-2027"), /Invalid year range/);
  assert.throws(() => parseYears("1999"), /between 2000 and 2099/);
});
