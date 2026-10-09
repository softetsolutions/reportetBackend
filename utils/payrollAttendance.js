import dayjs from "../utils/day.js";
import DailyVisit from "../models/Daily-Visit.js";
import Leave from "../models/Leave.js";
import OrgHoliday from "../models/OrgHoliday.js";
import PayrollSettings from "../models/PayrollSettings.js";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const getOrCreatePayrollSettings = async (organizationId) => {
  let settings = await PayrollSettings.findOne({ organizationId });
  if (!settings) {
    settings = await PayrollSettings.create({
      organizationId,
      weeklyOffWeekdays: [0],
      lopDivisorMethod: "calendar_days",
    });
  }
  return settings;
};

export const monthBounds = (year, month) => {
  const start = dayjs
    .tz(`${year}-${String(month).padStart(2, "0")}-01`, "Asia/Kolkata")
    .startOf("day");
  const end = start.endOf("month");
  return {
    start,
    end,
    startDate: start.toDate(),
    endDate: end.toDate(),
    startKey: start.format("YYYY-MM-DD"),
    endKey: end.format("YYYY-MM-DD"),
    calendarDays: end.date(),
  };
};

/**
 * Day priority: weeklyOff → holiday → present(visit) → paidLeave → unpaidLeave → absent
 */
export const computeEmployeeMonthAttendance = async ({
  organizationId,
  employeeId,
  year,
  month,
  settings,
}) => {
  const { startKey, endKey, calendarDays, startDate, endDate } = monthBounds(
    year,
    month,
  );
  const weeklyOffSet = new Set(settings.weeklyOffWeekdays || [0]);

  const [holidays, visits, leaves] = await Promise.all([
    OrgHoliday.find({
      organizationId,
      date: { $gte: startKey, $lte: endKey },
    })
      .select("date name")
      .lean(),
    DailyVisit.find({
      organizationId,
      employeeId,
      visitDate: { $gte: startKey, $lte: endKey },
    })
      .select("visitDate")
      .lean(),
    Leave.find({
      organizationId,
      employeeId,
      status: "approved",
      leaveDate: { $gte: startDate, $lte: endDate },
    })
      .populate("leaveType", "paid name code")
      .lean(),
  ]);

  const holidaySet = new Set(holidays.map((h) => h.date));
  const presentSet = new Set(visits.map((v) => v.visitDate));

  const paidLeaveSet = new Set();
  const unpaidLeaveSet = new Set();
  for (const leave of leaves) {
    const key = dayjs(leave.leaveDate).tz("Asia/Kolkata").format("YYYY-MM-DD");
    if (leave.leaveType?.paid) paidLeaveSet.add(key);
    else unpaidLeaveSet.add(key);
  }

  let weeklyOffDays = 0;
  let holidayDays = 0;
  let presentDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;

  let cursor = dayjs.tz(startKey, "Asia/Kolkata");
  const last = dayjs.tz(endKey, "Asia/Kolkata");

  while (cursor.isBefore(last) || cursor.isSame(last, "day")) {
    const key = cursor.format("YYYY-MM-DD");
    const weekday = cursor.day(); // 0 Sun … 6 Sat

    if (weeklyOffSet.has(weekday)) {
      weeklyOffDays += 1;
    } else if (holidaySet.has(key)) {
      holidayDays += 1;
    } else if (presentSet.has(key)) {
      presentDays += 1;
    } else if (paidLeaveSet.has(key)) {
      paidLeaveDays += 1;
    } else if (unpaidLeaveSet.has(key)) {
      unpaidLeaveDays += 1;
    } else {
      absentDays += 1;
    }

    cursor = cursor.add(1, "day");
  }

  const workingDaysInMonth =
    calendarDays - weeklyOffDays - holidayDays;
  const suggestedLopDays = unpaidLeaveDays + absentDays;

  return {
    calendarDays,
    weeklyOffDays,
    holidayDays,
    presentDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    workingDaysInMonth: Math.max(workingDaysInMonth, 0),
    suggestedLopDays,
  };
};

export const resolveDivisorDays = (attendance, lopDivisorMethod) => {
  if (lopDivisorMethod === "working_days") {
    return Math.max(attendance.workingDaysInMonth || 0, 1);
  }
  return Math.max(attendance.calendarDays || 0, 1);
};

export const computeLopAmount = (gross, finalLopDays, divisorDays) => {
  if (!finalLopDays || finalLopDays <= 0) return 0;
  return round2((gross / divisorDays) * finalLopDays);
};

export const sumLines = (lines = []) =>
  round2(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0));

export { round2 };
