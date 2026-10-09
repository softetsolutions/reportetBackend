import {
  loadMonthCalendarContext,
  dayPlanMapFromDoc,
  dayPlansObjectFromMap,
  countPlannedWorkingDays,
  buildCalendarWithPlanStatus,
  canEditTourPlan,
  defaultSelectedDate,
} from "./tourPlanCalendar.js";
import { enrichDayPlans } from "./tourPlanEnrichment.js";

const reviewFields = (monthDoc) => ({
  submittedAt: monthDoc?.submittedAt || null,
  reviewedBy: monthDoc?.reviewedBy || null,
  reviewedByRole: monthDoc?.reviewedByRole || null,
  reviewedAt: monthDoc?.reviewedAt || null,
  rejectionReason: monthDoc?.rejectionReason || null,
});

/**
 * @param {"employee"|"manager"|"managerDetail"|"list"} mode
 * - employee: MR month screen (canEdit, selectedDate, dayPlan)
 * - manager: approval detail (IDs in dayPlans)
 * - managerDetail: approval detail with populated areas/doctors per day
 * - list: manager list row (summary + meta only)
 */
export const buildTourPlanMonthView = async ({
  monthDoc,
  calendarContext: calendarContextIn,
  selectedDateHint = null,
  mode = "employee",
}) => {
  const calendarContext =
    calendarContextIn ??
    (await loadMonthCalendarContext(
      monthDoc.organizationId,
      monthDoc.year,
      monthDoc.month,
    ));

  const planMap = dayPlanMapFromDoc(monthDoc);
  const dayPlans = dayPlansObjectFromMap(planMap);
  const status = monthDoc?.status || "draft";
  const summary = {
    totalWorkingDays: calendarContext.totalWorkingDays,
    plannedDaysCount: countPlannedWorkingDays(calendarContext.days, planMap),
  };

  const base = {
    ...(monthDoc._id && { _id: monthDoc._id }),
    year: monthDoc.year,
    month: monthDoc.month,
    status,
    ...reviewFields(monthDoc),
    summary,
  };

  if (mode === "list") {
    return {
      ...base,
      employeeId: monthDoc.employeeId,
      createdAt: monthDoc.createdAt,
      updatedAt: monthDoc.updatedAt,
    };
  }

  const calendar = {
    days: buildCalendarWithPlanStatus(calendarContext.days, planMap),
  };

  if (mode === "manager" || mode === "managerDetail") {
    const managerBase = {
      ...base,
      employeeId: monthDoc.employeeId,
      calendar,
      dayPlans,
    };

    if (mode === "managerDetail") {
      const enriched = await enrichDayPlans(monthDoc.organizationId, dayPlans);
      return {
        ...managerBase,
        dayPlans: enriched.dayPlans,
        days: enriched.days,
      };
    }

    return managerBase;
  }

  const selectedDate = defaultSelectedDate(
    calendarContext.days,
    planMap,
    selectedDateHint,
  );

  return {
    ...base,
    canEdit: canEditTourPlan(status),
    calendar,
    selectedDate,
    dayPlans,
    dayPlan: selectedDate ? dayPlans[selectedDate] || null : null,
  };
};
