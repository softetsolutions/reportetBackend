/**
 * India holiday presets for payroll calendar seeding.
 * - Fixed national holidays apply every year.
 * - Year packs include common gazetted / widely observed dates
 *   (Central Govt style lists). Orgs should still review and add regional holidays.
 */

const FIXED_NATIONAL = [
  { month: 1, day: 26, name: "Republic Day" },
  { month: 8, day: 15, name: "Independence Day" },
  { month: 10, day: 2, name: "Gandhi Jayanti" },
];

/** Extra fixed civil dates often observed (not only the 3 national). */
const FIXED_COMMON = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 5, day: 1, name: "May Day / Labour Day" },
  { month: 12, day: 25, name: "Christmas Day" },
];

/**
 * Year-specific movable / gazetted dates (approx. as commonly published).
 * Admin should verify against the latest DoPT / state circular.
 */
const YEAR_PACKS = {
  2025: [
    { date: "2025-03-14", name: "Holi" },
    { date: "2025-03-31", name: "Id-ul-Fitr" },
    { date: "2025-04-10", name: "Mahavir Jayanti" },
    { date: "2025-04-18", name: "Good Friday" },
    { date: "2025-04-14", name: "Ambedkar Jayanti" },
    { date: "2025-05-12", name: "Buddha Purnima" },
    { date: "2025-06-07", name: "Id-ul-Zuha (Bakrid)" },
    { date: "2025-07-06", name: "Muharram" },
    { date: "2025-08-16", name: "Janmashtami" },
    { date: "2025-09-05", name: "Milad-un-Nabi" },
    { date: "2025-10-02", name: "Dussehra (Vijayadashami)" },
    { date: "2025-10-20", name: "Diwali (Deepavali)" },
    { date: "2025-11-05", name: "Guru Nanak Jayanti" },
  ],
  2026: [
    { date: "2026-03-04", name: "Holi" },
    { date: "2026-03-21", name: "Id-ul-Fitr" },
    { date: "2026-03-31", name: "Mahavir Jayanti" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-14", name: "Ambedkar Jayanti" },
    { date: "2026-05-01", name: "Buddha Purnima" },
    { date: "2026-05-28", name: "Id-ul-Zuha (Bakrid)" },
    { date: "2026-06-26", name: "Muharram" },
    { date: "2026-08-15", name: "Janmashtami" },
    { date: "2026-08-26", name: "Milad-un-Nabi" },
    { date: "2026-10-20", name: "Dussehra (Vijayadashami)" },
    { date: "2026-11-08", name: "Diwali (Deepavali)" },
    { date: "2026-11-24", name: "Guru Nanak Jayanti" },
  ],
  2027: [
    { date: "2027-03-22", name: "Holi" },
    { date: "2027-03-10", name: "Id-ul-Fitr" },
    { date: "2027-04-19", name: "Mahavir Jayanti" },
    { date: "2027-03-26", name: "Good Friday" },
    { date: "2027-04-14", name: "Ambedkar Jayanti" },
    { date: "2027-05-20", name: "Buddha Purnima" },
    { date: "2027-05-17", name: "Id-ul-Zuha (Bakrid)" },
    { date: "2027-06-15", name: "Muharram" },
    { date: "2027-08-20", name: "Janmashtami" },
    { date: "2027-09-15", name: "Milad-un-Nabi" },
    { date: "2027-10-09", name: "Dussehra (Vijayadashami)" },
    { date: "2027-10-29", name: "Diwali (Deepavali)" },
    { date: "2027-11-14", name: "Guru Nanak Jayanti" },
  ],
};

const pad = (n) => String(n).padStart(2, "0");

const toDateKey = (year, month, day) =>
  `${year}-${pad(month)}-${pad(day)}`;

const mergeByDate = (items) => {
  const map = new Map();
  for (const item of items) {
    if (!item?.date || !item?.name) continue;
    map.set(item.date, { date: item.date, name: item.name });
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
};

export const listIndiaHolidayPresetMeta = () => {
  const years = Object.keys(YEAR_PACKS)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    packId: "india_national",
    name: "India national / common gazetted",
    description:
      "Seeds fixed national holidays plus common gazetted festival dates for supported years. Review and add state/regional holidays after applying.",
    supportedYears: years,
    fixedNational: FIXED_NATIONAL.map(
      (h) => `${pad(h.month)}-${pad(h.day)} ${h.name}`,
    ),
    note: "Movable festival dates vary; verify against the latest government circular for your location.",
  };
};

/**
 * Build holiday list for a year.
 * Always includes fixed national + fixed common.
 * Adds year pack when available.
 */
export const buildIndiaHolidayPreset = (year) => {
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) {
    throw new Error("Invalid year");
  }

  const fixed = [
    ...FIXED_NATIONAL.map((h) => ({
      date: toDateKey(y, h.month, h.day),
      name: h.name,
    })),
    ...FIXED_COMMON.map((h) => ({
      date: toDateKey(y, h.month, h.day),
      name: h.name,
    })),
  ];

  const pack = YEAR_PACKS[y] || [];
  const holidays = mergeByDate([...fixed, ...pack]);

  return {
    packId: "india_national",
    year: y,
    hasYearPack: Boolean(YEAR_PACKS[y]),
    holidays,
    warning: YEAR_PACKS[y]
      ? "Preset applied from built-in pack. Confirm festival dates for your state/org before payroll."
      : "No full year pack for this year — only fixed-date holidays were included. Add festivals via Excel bulk upload.",
  };
};

export const INDIA_PRESET_ID = "india_national";
