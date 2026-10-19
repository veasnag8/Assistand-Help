import test from "node:test";
import assert from "node:assert/strict";
import {
  categoryKey,
  generateNumberingRows,
  normalizeCategory,
  parseBranches,
  parseYears,
  validateCategory,
} from "./acumatica-numbering.js";

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

test("normalizes imported category columns and validates category keys", () => {
  const category = normalizeCategory({ "Numbering Code": " cm ", "Numbering ID": " catran ", Enabled: "Disabled" }, "row-1");
  assert.deepEqual(category, { id: "row-1", code: "CM", numberingId: "CATRAN", description: "", enabled: false });
  assert.equal(categoryKey(category), "CM\u0000CATRAN");
  assert.equal(validateCategory(category), "");
  assert.match(validateCategory({ code: "BAD CODE", numberingId: "OK" }), /Numbering Code/);
});

test("rejects invalid branches and years", () => {
  assert.throws(() => parseBranches("AP-$"), /Invalid Branch/);
  assert.throws(() => parseYears("2028-2027"), /Invalid year range/);
  assert.throws(() => parseYears("1999"), /between 2000 and 2099/);
});
