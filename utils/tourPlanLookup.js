import TourPlanMonth from "../models/TourPlanMonth.js";
import { parseDateKey, isPlannedDay } from "./tourPlanCalendar.js";

export const getTourPlanDayForEmployee = async ({
  organizationId,
  employeeId,
  visitDate,
}) => {
  const parsed = parseDateKey(visitDate);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const monthDoc = await TourPlanMonth.findOne({
    organizationId,
    employeeId,
    year: parsed.year,
    month: parsed.month,
  })
    .select("days")
    .lean();

  const raw = (monthDoc?.days || []).find((d) => d.date === parsed.date);
  if (!isPlannedDay(raw)) {
    return {
      date: parsed.date,
      hasPlan: false,
      areaIds: [],
      doctorIds: [],
    };
  }

  return {
    date: parsed.date,
    hasPlan: true,
    areaIds: (raw.areaIds || []).map(String),
    doctorIds: (raw.doctorIds || []).map(String),
  };
};
