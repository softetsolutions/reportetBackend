import dayjs from "./day.js";
import OrgHoliday from "../models/OrgHoliday.js";
import { getOrCreatePayrollSettings } from "./payrollAttendance.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TZ = "Asia/Kolkata";

export const parseDateKey = (dateStr) => {
  const d = String(dateStr || "").trim();
  if (!DATE_RE.test(d)) {
    return { error: "date must be YYYY-MM-DD" };
  }
  const [y, m, day] = d.split("-").map(Number);
  const parsed = dayjs.tz(d, TZ);
  if (
    !parsed.isValid() ||
    parsed.year() !== y ||
    parsed.month() + 1 !== m ||
    parsed.date() !== day
  ) {
    return { error: `invalid calendar date: ${d}` };
  }
  return { date: d, year: y, month: m, day };
};

export const parseYearMonth = (yearRaw, monthRaw) => {
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "year must be an integer between 2000 and 2100" };
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "month must be an integer between 1 and 12" };
  }
  return { year, month };
};

export const monthBounds = (year, month) => {
  const start = dayjs
    .tz(`${year}-${String(month).padStart(2, "0")}-01`, TZ)
    .startOf("day");
  const end = start.endOf("month");
  return {
    start,
    end,
    startKey: start.format("YYYY-MM-DD"),
    endKey: end.format("YYYY-MM-DD"),
    daysInMonth: end.date(),
  };
};

export const prevYearMonth = (year, month) => {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
};

export const loadMonthCalendarContext = async (organizationId, year, month) => {
  const { startKey, endKey, daysInMonth, start, end } = monthBounds(
    year,
    month,
  );
  const settings = await getOrCreatePayrollSettings(organizationId);
  const weeklyOffSet = new Set(settings.weeklyOffWeekdays || [0]);

  const holidays = await OrgHoliday.find({
    organizationId,
    date: { $gte: startKey, $lte: endKey },
  })
    .select("date name")
    .lean();

  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));

  const days = [];
  let totalWorkingDays = 0;
  let cursor = start;
  while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
    const date = cursor.format("YYYY-MM-DD");
    const dayOfWeek = cursor.day();
    const isWeeklyOff = weeklyOffSet.has(dayOfWeek);
    const holidayName = holidayByDate.get(date) || null;
    const isHoliday = Boolean(holidayName);
    const isSelectable = !isWeeklyOff && !isHoliday;
    if (isSelectable) totalWorkingDays += 1;

    days.push({
      date,
      dayOfMonth: cursor.date(),
      dayOfWeek,
      isSelectable,
      isWeeklyOff,
      isHoliday,
      holidayName,
    });
    cursor = cursor.add(1, "day");
  }

  return {
    year,
    month,
    daysInMonth,
    days,
    totalWorkingDays,
    weeklyOffSet,
    holidayByDate,
  };
};

export const isWorkingDayKey = (dateKey, weeklyOffSet, holidayByDate) => {
  const parsed = parseDateKey(dateKey);
  if (parsed.error) return false;
  const weekday = dayjs.tz(dateKey, TZ).day();
  if (weeklyOffSet.has(weekday)) return false;
  if (holidayByDate.has(dateKey)) return false;
  return true;
};

/** A day counts as planned when it has at least one area and one doctor. */
export const isPlannedDay = (dayPlan) =>
  Boolean(
    dayPlan?.areaIds?.length > 0 && dayPlan?.doctorIds?.length > 0,
  );

export const dayPlanMapFromDoc = (monthDoc) => {
  const map = new Map();
  for (const d of monthDoc?.days || []) {
    map.set(d.date, {
      date: d.date,
      areaIds: (d.areaIds || []).map(String),
      doctorIds: (d.doctorIds || []).map(String),
    });
  }
  return map;
};

/** Planned days only — keyed by YYYY-MM-DD for mobile date taps. */
export const dayPlansObjectFromMap = (planMap) => {
  const dayPlans = {};
  for (const [date, plan] of planMap.entries()) {
    if (isPlannedDay(plan)) {
      dayPlans[date] = plan;
    }
  }
  return dayPlans;
};

export const countPlannedWorkingDays = (calendarDays, planMap) => {
  let count = 0;
  for (const cal of calendarDays) {
    if (!cal.isSelectable) continue;
    const plan = planMap.get(cal.date);
    if (isPlannedDay(plan)) count += 1;
  }
  return count;
};

export const buildCalendarWithPlanStatus = (calendarDays, planMap) =>
  calendarDays.map((cal) => {
    if (!cal.isSelectable) {
      return { ...cal, planStatus: null };
    }
    const plan = planMap.get(cal.date);
    return {
      ...cal,
      planStatus: isPlannedDay(plan) ? "planned" : "unplanned",
    };
  });

export const canEditTourPlan = (status) =>
  status === "draft" || status === "rejected";

export const defaultSelectedDate = (calendarDays, planMap, hint) => {
  if (hint) {
    const parsed = parseDateKey(hint);
    if (!parsed.error) {
      const cal = calendarDays.find((d) => d.date === parsed.date);
      if (cal?.isSelectable) return parsed.date;
    }
  }
  const today = dayjs().tz(TZ).format("YYYY-MM-DD");
  const todayCal = calendarDays.find((d) => d.date === today);
  if (todayCal?.isSelectable) return today;

  const firstUnplanned = calendarDays.find(
    (d) => d.isSelectable && !isPlannedDay(planMap.get(d.date)),
  );
  if (firstUnplanned) return firstUnplanned.date;

  const firstWorking = calendarDays.find((d) => d.isSelectable);
  return firstWorking?.date || null;
};
