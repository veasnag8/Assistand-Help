import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Trash2, X } from "lucide-react";
import { lunar } from "khmercal";

const khmerWeekdays = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហ", "សុក្រ", "សៅរ៍"];
const khmerMonths = [
  "មករា",
  "កុម្ភៈ",
  "មីនា",
  "មេសា",
  "ឧសភា",
  "មិថុនា",
  "កក្កដា",
  "សីហា",
  "កញ្ញា",
  "តុលា",
  "វិច្ឆិកា",
  "ធ្នូ",
];
const khmercalMonthNames = {
  "MĬKÔSĔR": "មិគសិរ",
  "BŎSS": "បុស្ស",
  "MÉAKH": "មាឃ",
  "PHÂLKŬN": "ផល្គុន",
  "CHÉTR": "ចេត្រ",
  "VĬSAKH": "ពិសាខ",
  "CHÉSTH": "ជេស្ឋ",
  "ASATH": "អាសាឍ",
  "BÂTHÂMSATH": "បឋមាសាឍ",
  "TŬTĔYÉASATH": "ទុតិយាសាឍ",
  "SRAPÔNÂ": "ស្រាពណ៍",
  "PHÔTRÔBÂT": "ភទ្របទ",
  "ÂSSŎCH": "អស្សុជ",
  "KÂTDĔK": "កត្តិក",
};
const khmerZodiacYears = [
  "ជូត",
  "ឆ្លូវ",
  "ខាល",
  "ថោះ",
  "រោង",
  "ម្សាញ់",
  "មមី",
  "មមែ",
  "វក",
  "រកា",
  "ច",
  "កុរ",
];
const khmerLunarMonthRanges = [
  "បុស្ស - មាឃ",
  "មាឃ - ផល្គុន",
  "ផល្គុន - ចេត្រ",
  "ចេត្រ - ពិសាខ",
  "ពិសាខ - ជេស្ឋ",
  "ជេស្ឋ - បឋមាសាឍ",
  "បឋមាសាឍ - ទុតិយាសាឍ",
  "ទុតិយាសាឍ - ស្រាពណ៍",
  "ស្រាពណ៍ - ភទ្របទ",
  "ភទ្របទ - អស្សុជ",
  "អស្សុជ - កត្តិក",
  "កត្តិក - មិគសិរ",
];
const khmerDigits = ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"];
const personalNotesStorageKey = "khmer-calendar-personal-notes-v1";
const defaultEvents = [
  { color: "red", date: "2026-01-01", id: "kh-holiday-2026-01-01", title: "ទិវាចូលឆ្នាំសកល" },
  { color: "red", date: "2026-01-07", id: "kh-holiday-2026-01-07", title: "ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍" },
  { color: "red", date: "2026-02-16", id: "cn-new-year-eve-2026-02-16", title: "សែនចូលឆ្នាំចិន" },
  { color: "red", date: "2026-02-17", id: "cn-new-year-2026-02-17", title: "ចូលឆ្នាំចិន" },
  { color: "red", date: "2026-02-18", id: "cn-new-year-day-2-2026-02-18", title: "ចូលឆ្នាំចិន ថ្ងៃទី២" },
  { color: "red", date: "2026-03-08", id: "kh-holiday-2026-03-08", title: "ទិវានារីអន្តរជាតិ" },
  { color: "red", date: "2026-04-14", id: "kh-holiday-2026-04-14", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី១" },
  { color: "red", date: "2026-04-15", id: "kh-holiday-2026-04-15", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី២" },
  { color: "red", date: "2026-04-16", id: "kh-holiday-2026-04-16", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី៣" },
  { color: "red", date: "2026-05-01", id: "kh-holiday-2026-05-01", title: "ទិវាពលកម្មអន្តរជាតិ និងវិសាខបូជា" },
  { color: "red", date: "2026-05-05", id: "kh-holiday-2026-05-05", title: "ព្រះរាជពិធីច្រត់ព្រះនង្គ័ល" },
  { color: "red", date: "2026-05-14", id: "kh-holiday-2026-05-14", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រ" },
  { color: "red", date: "2026-06-18", id: "kh-holiday-2026-06-18", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រី" },
  { color: "red", date: "2026-09-24", id: "kh-holiday-2026-09-24", title: "ទិវារដ្ឋធម្មនុញ្ញ" },
  { color: "red", date: "2026-10-10", id: "kh-holiday-2026-10-10", title: "បុណ្យភ្ជុំបិណ្ឌ ថ្ងៃទី១" },
  { color: "red", date: "2026-10-11", id: "kh-holiday-2026-10-11", title: "បុណ្យភ្ជុំបិណ្ឌ ថ្ងៃទី២" },
  { color: "red", date: "2026-10-12", id: "kh-holiday-2026-10-12", title: "បុណ្យភ្ជុំបិណ្ឌ ថ្ងៃទី៣" },
  { color: "red", date: "2026-10-15", id: "kh-holiday-2026-10-15", title: "ទិវាប្រារព្ធព្រះបរមរតនកោដ្ឋ" },
  { color: "red", date: "2026-10-29", id: "kh-holiday-2026-10-29", title: "ព្រះរាជពិធីគ្រងរាជ្យ" },
  { color: "red", date: "2026-11-09", id: "kh-holiday-2026-11-09", title: "ទិវាឯករាជ្យជាតិ" },
  { color: "red", date: "2026-11-23", id: "kh-holiday-2026-11-23", title: "បុណ្យអុំទូក ថ្ងៃទី១" },
  { color: "red", date: "2026-11-24", id: "kh-holiday-2026-11-24", title: "បុណ្យអុំទូក ថ្ងៃទី២" },
  { color: "red", date: "2026-11-25", id: "kh-holiday-2026-11-25", title: "បុណ្យអុំទូក ថ្ងៃទី៣" },
  { color: "red", date: "2026-12-29", id: "kh-holiday-2026-12-29", title: "ទិវាសន្តិភាពនៅកម្ពុជា" },
  { color: "red", date: "2027-01-01", id: "kh-holiday-2027-01-01", title: "ទិវាចូលឆ្នាំសកល" },
  { color: "red", date: "2027-01-07", id: "kh-holiday-2027-01-07", title: "ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍" },
  { color: "red", date: "2027-02-05", id: "cn-new-year-eve-2027-02-05", title: "សែនចូលឆ្នាំចិន" },
  { color: "red", date: "2027-02-06", id: "cn-new-year-2027-02-06", title: "ចូលឆ្នាំចិន" },
  { color: "red", date: "2027-02-07", id: "cn-new-year-day-2-2027-02-07", title: "ចូលឆ្នាំចិន ថ្ងៃទី២" },
  { color: "red", date: "2027-03-08", id: "kh-holiday-2027-03-08", title: "ទិវានារីអន្តរជាតិ" },
  { color: "red", date: "2027-04-14", id: "kh-holiday-2027-04-14", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី១" },
  { color: "red", date: "2027-04-15", id: "kh-holiday-2027-04-15", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី២" },
  { color: "red", date: "2027-04-16", id: "kh-holiday-2027-04-16", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី៣" },
  { color: "red", date: "2027-05-01", id: "kh-holiday-2027-05-01", title: "ទិវាពលកម្មអន្តរជាតិ" },
  { color: "red", date: "2027-05-14", id: "kh-holiday-2027-05-14", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រ" },
  { color: "red", date: "2027-06-18", id: "kh-holiday-2027-06-18", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រី" },
  { color: "red", date: "2027-09-24", id: "kh-holiday-2027-09-24", title: "ទិវារដ្ឋធម្មនុញ្ញ" },
  { color: "red", date: "2027-10-15", id: "kh-holiday-2027-10-15", title: "ទិវាប្រារព្ធព្រះបរមរតនកោដ្ឋ" },
  { color: "red", date: "2027-10-29", id: "kh-holiday-2027-10-29", title: "ព្រះរាជពិធីគ្រងរាជ្យ" },
  { color: "red", date: "2027-11-09", id: "kh-holiday-2027-11-09", title: "ទិវាឯករាជ្យជាតិ" },
  { color: "red", date: "2027-12-29", id: "kh-holiday-2027-12-29", title: "ទិវាសន្តិភាពនៅកម្ពុជា" },
  { color: "red", date: "2028-01-01", id: "kh-holiday-2028-01-01", title: "ទិវាចូលឆ្នាំសកល" },
  { color: "red", date: "2028-01-07", id: "kh-holiday-2028-01-07", title: "ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍" },
  { color: "red", date: "2028-01-25", id: "cn-new-year-eve-2028-01-25", title: "សែនចូលឆ្នាំចិន" },
  { color: "red", date: "2028-01-26", id: "cn-new-year-2028-01-26", title: "ចូលឆ្នាំចិន" },
  { color: "red", date: "2028-01-27", id: "cn-new-year-day-2-2028-01-27", title: "ចូលឆ្នាំចិន ថ្ងៃទី២" },
  { color: "red", date: "2028-03-08", id: "kh-holiday-2028-03-08", title: "ទិវានារីអន្តរជាតិ" },
  { color: "red", date: "2028-04-14", id: "kh-holiday-2028-04-14", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី១" },
  { color: "red", date: "2028-04-15", id: "kh-holiday-2028-04-15", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី២" },
  { color: "red", date: "2028-04-16", id: "kh-holiday-2028-04-16", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី៣" },
  { color: "red", date: "2028-05-01", id: "kh-holiday-2028-05-01", title: "ទិវាពលកម្មអន្តរជាតិ" },
  { color: "red", date: "2028-05-14", id: "kh-holiday-2028-05-14", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រ" },
  { color: "red", date: "2028-06-18", id: "kh-holiday-2028-06-18", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រី" },
  { color: "red", date: "2028-09-24", id: "kh-holiday-2028-09-24", title: "ទិវារដ្ឋធម្មនុញ្ញ" },
  { color: "red", date: "2028-10-15", id: "kh-holiday-2028-10-15", title: "ទិវាប្រារព្ធព្រះបរមរតនកោដ្ឋ" },
  { color: "red", date: "2028-10-29", id: "kh-holiday-2028-10-29", title: "ព្រះរាជពិធីគ្រងរាជ្យ" },
  { color: "red", date: "2028-11-09", id: "kh-holiday-2028-11-09", title: "ទិវាឯករាជ្យជាតិ" },
  { color: "red", date: "2028-12-29", id: "kh-holiday-2028-12-29", title: "ទិវាសន្តិភាពនៅកម្ពុជា" },
  { color: "red", date: "2029-01-01", id: "kh-holiday-2029-01-01", title: "ទិវាចូលឆ្នាំសកល" },
  { color: "red", date: "2029-01-07", id: "kh-holiday-2029-01-07", title: "ទិវាជ័យជម្នះលើរបបប្រល័យពូជសាសន៍" },
  { color: "red", date: "2029-02-12", id: "cn-new-year-eve-2029-02-12", title: "សែនចូលឆ្នាំចិន" },
  { color: "red", date: "2029-02-13", id: "cn-new-year-2029-02-13", title: "ចូលឆ្នាំចិន" },
  { color: "red", date: "2029-02-14", id: "cn-new-year-day-2-2029-02-14", title: "ចូលឆ្នាំចិន ថ្ងៃទី២" },
  { color: "red", date: "2029-03-08", id: "kh-holiday-2029-03-08", title: "ទិវានារីអន្តរជាតិ" },
  { color: "red", date: "2029-04-14", id: "kh-holiday-2029-04-14", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី១" },
  { color: "red", date: "2029-04-15", id: "kh-holiday-2029-04-15", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី២" },
  { color: "red", date: "2029-04-16", id: "kh-holiday-2029-04-16", title: "ចូលឆ្នាំខ្មែរ ថ្ងៃទី៣" },
  { color: "red", date: "2029-05-01", id: "kh-holiday-2029-05-01", title: "ទិវាពលកម្មអន្តរជាតិ" },
  { color: "red", date: "2029-05-14", id: "kh-holiday-2029-05-14", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រ" },
  { color: "red", date: "2029-06-18", id: "kh-holiday-2029-06-18", title: "ព្រះរាជពិធីបុណ្យចម្រើនព្រះជន្មព្រះមហាក្សត្រី" },
  { color: "red", date: "2029-09-24", id: "kh-holiday-2029-09-24", title: "ទិវារដ្ឋធម្មនុញ្ញ" },
  { color: "red", date: "2029-10-15", id: "kh-holiday-2029-10-15", title: "ទិវាប្រារព្ធព្រះបរមរតនកោដ្ឋ" },
  { color: "red", date: "2029-10-29", id: "kh-holiday-2029-10-29", title: "ព្រះរាជពិធីគ្រងរាជ្យ" },
  { color: "red", date: "2029-11-09", id: "kh-holiday-2029-11-09", title: "ទិវាឯករាជ្យជាតិ" },
  { color: "red", date: "2029-12-29", id: "kh-holiday-2029-12-29", title: "ទិវាសន្តិភាពនៅកម្ពុជា" },
];

function toKhmerNumber(value) {
  return String(value).replace(/\d/g, (digit) => khmerDigits[Number(digit)]);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getCalendarCells(year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const previousMonth = month === 0 ? 11 : month - 1;
  const previousYear = month === 0 ? year - 1 : year;
  const previousMonthDays = getDaysInMonth(previousYear, previousMonth);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const dayOffset = index - firstDay + 1;
    let cellYear = year;
    let cellMonth = month;
    let day = dayOffset;
    let outside = false;

    if (dayOffset < 1) {
      cellYear = previousYear;
      cellMonth = previousMonth;
      day = previousMonthDays + dayOffset;
      outside = true;
    } else if (dayOffset > daysInMonth) {
      cellMonth = month === 11 ? 0 : month + 1;
      cellYear = month === 11 ? year + 1 : year;
      day = dayOffset - daysInMonth;
      outside = true;
    }

    const date = new Date(cellYear, cellMonth, day);

    cells.push({
      date,
      day,
      key: toDateKey(date),
      outside,
      weekday: date.getDay(),
    });
  }

  return cells;
}

function getLunarLabel(date) {
  const lunarDate = lunar(date);
  const day = lunarDate.period[0];
  const phase = lunarDate.period[1] === "K" ? "កើត" : "រោច";
  const month = khmercalMonthNames[lunarDate.month.name] || lunarDate.month.name;

  return `${toKhmerNumber(day)} ${phase}${day === 1 ? ` ${month}` : ""}`;
}

function getSilDayEvent(date) {
  const lunarDay = lunar(date).period[0];

  if (lunarDay !== 8 && lunarDay !== 15) {
    return null;
  }

  const dateKey = toDateKey(date);

  return {
    color: "blue",
    date: dateKey,
    id: `sil-day-${dateKey}`,
    title: "ថ្ងៃសីល",
  };
}

function formatKhmerToday(date) {
  return `ថ្ងៃនេះ ${khmerWeekdays[date.getDay()]} ទី${toKhmerNumber(date.getDate())} ${khmerMonths[date.getMonth()]} ${toKhmerNumber(date.getFullYear())}`;
}

function formatKhmerEraDate(date) {
  const buddhistYear = date.getFullYear() + 544;
  const zodiacYear = khmerZodiacYears[(date.getFullYear() - 2026 + 6) % khmerZodiacYears.length];

  return `${khmerLunarMonthRanges[date.getMonth()]} ឆ្នាំ${zodiacYear} ព.ស. ${toKhmerNumber(buddhistYear)}`;
}

function loadPersonalNotes() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(personalNotesStorageKey) || "{}");

    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export default function KhmerCalendarTool() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [personalNotes, setPersonalNotes] = useState(loadPersonalNotes);
  const [activeNoteDate, setActiveNoteDate] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const events = defaultEvents;
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const viewEraDate = new Date(year, month, 1);
  const cells = useMemo(() => getCalendarCells(year, month), [year, month]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map();

    for (const event of events) {
      grouped.set(event.date, [...(grouped.get(event.date) || []), event]);
    }

    return grouped;
  }, [events]);

  function moveMonth(amount) {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  }

  useEffect(() => {
    window.localStorage.setItem(personalNotesStorageKey, JSON.stringify(personalNotes));
  }, [personalNotes]);

  function openNote(cell) {
    setActiveNoteDate(cell.key);
    setNoteDraft(personalNotes[cell.key] || "");
  }

  function closeNote() {
    setActiveNoteDate("");
    setNoteDraft("");
  }

  function saveNote(event) {
    event.preventDefault();
    const note = noteDraft.trim();

    setPersonalNotes((current) => {
      const next = { ...current };

      if (note) {
        next[activeNoteDate] = note;
      } else {
        delete next[activeNoteDate];
      }

      return next;
    });
    closeNote();
  }

  function deleteNote() {
    setPersonalNotes((current) => {
      const next = { ...current };
      delete next[activeNoteDate];
      return next;
    });
    closeNote();
  }

  return (
    <section className="khmer-calendar-tool" aria-labelledby="khmer-calendar-title">
      <div className="khmer-calendar-toolbar">
        <div>
          <p className="eyebrow">Khmer Calendar</p>
          <h1 id="khmer-calendar-title">
            {formatKhmerToday(today)}
          </h1>
          <div className="khmer-calendar-date-systems">
            <span>{formatKhmerEraDate(viewEraDate)}</span>
          </div>
        </div>
        <div className="khmer-calendar-view-title" aria-live="polite">
          {khmerMonths[month]} {toKhmerNumber(year)}
        </div>
        <div className="khmer-calendar-actions">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={18} strokeWidth={2.3} />
          </button>
          <button type="button" onClick={() => setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Today
          </button>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
            <ChevronRight size={18} strokeWidth={2.3} />
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Print calendar">
            <Printer size={17} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="khmer-calendar-workspace">
        <div className="khmer-calendar-sheet">
          <div className="khmer-calendar-grid khmer-calendar-weekdays">
            {khmerWeekdays.map((weekday) => (
              <div key={weekday}>{weekday}</div>
            ))}
          </div>
          <div className="khmer-calendar-grid">
            {cells.map((cell) => {
              const fixedEvents = eventsByDate.get(cell.key) || [];
              const silDayEvent = getSilDayEvent(cell.date);
              const dayEvents = cell.outside ? [] : [...fixedEvents, ...(silDayEvent ? [silDayEvent] : [])];
              const isToday = cell.key === toDateKey(today);
              const isWeekend = cell.weekday === 0;
              const hasHoliday = !cell.outside && fixedEvents.length > 0;
              const personalNote = personalNotes[cell.key] || "";

              return (
                <button
                  type="button"
                  className={`khmer-calendar-cell${cell.outside ? " is-outside" : ""}${isToday ? " is-today" : ""}${isWeekend ? " is-weekend" : ""}${hasHoliday ? " has-holiday" : ""}`}
                  key={cell.key}
                  onClick={() => openNote(cell)}
                  aria-label={`Add personal note for ${cell.key}`}
                >
                  <div className="khmer-calendar-day">
                    <strong>{cell.day}</strong>
                    <span>{getLunarLabel(cell.date)}</span>
                  </div>
                  <div className="khmer-calendar-event-list">
                    {dayEvents.map((event) => (
                      <span className={`khmer-calendar-event is-${event.color}`} key={event.id}>
                        {event.title}
                      </span>
                    ))}
                  </div>
                  {personalNote ? <span className="khmer-calendar-note">{personalNote}</span> : null}
                </button>
              );
            })}
          </div>
        </div>

      </div>
      {activeNoteDate ? (
        <div className="calendar-note-backdrop" role="presentation" onMouseDown={closeNote}>
          <section
            className="calendar-note-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-note-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="calendar-note-header">
              <div>
                <p className="eyebrow">Personal Note</p>
                <h2 id="calendar-note-title">{activeNoteDate}</h2>
              </div>
              <button type="button" onClick={closeNote} aria-label="Close note">
                <X size={18} strokeWidth={2.4} />
              </button>
            </header>
            <form className="calendar-note-form" onSubmit={saveNote}>
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Write your note"
                rows={5}
                autoFocus
              />
              <div className="calendar-note-actions">
                <button className="button ghost" type="button" onClick={deleteNote} disabled={!personalNotes[activeNoteDate]}>
                  <Trash2 size={15} strokeWidth={2.2} />
                  <span>Delete</span>
                </button>
                <button className="button" type="submit">
                  <span>Save Note</span>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
