import TourPlanMonth from "../models/TourPlanMonth.js";
import {
  parseDateKey,
  parseYearMonth,
  loadMonthCalendarContext,
  isWorkingDayKey,
  dayPlanMapFromDoc,
  countPlannedWorkingDays,
  canEditTourPlan,
  prevYearMonth,
  isPlannedDay,
} from "../utils/tourPlanCalendar.js";
import { buildTourPlanMonthView } from "../utils/tourPlanResponse.js";
import { validateDayPlanPayload } from "../utils/tourPlanValidation.js";
import { getTourPlanDayForEmployee } from "../utils/tourPlanLookup.js";

const orgAndEmployee = (req) => ({
  organizationId: req.employee.organizationId,
  employeeId: req.employee._id,
});

const findOrCreateMonthDoc = async ({ organizationId, employeeId, year, month }) => {
  let doc = await TourPlanMonth.findOne({
    organizationId,
    employeeId,
    year,
    month,
  });
  if (!doc) {
    doc = new TourPlanMonth({
      organizationId,
      employeeId,
      year,
      month,
      status: "draft",
      days: [],
    });
  }
  return doc;
};

const resetRejectedToDraft = (monthDoc) => {
  if (monthDoc.status === "rejected") {
    monthDoc.status = "draft";
    monthDoc.rejectionReason = null;
    monthDoc.reviewedBy = null;
    monthDoc.reviewedByRole = null;
    monthDoc.reviewedAt = null;
  }
};

const applyDayInputsToMonthDoc = async ({
  monthDoc,
  calendarContext,
  employee,
  dayInputs,
}) => {
  if (!Array.isArray(dayInputs)) {
    return { error: "days must be an array" };
  }

  const seenDates = new Set();
  const normalizedDays = [];

  for (const raw of dayInputs) {
    const dateParsed = parseDateKey(raw?.date);
    if (dateParsed.error) {
      return { error: dateParsed.error };
    }

    if (dateParsed.year !== monthDoc.year || dateParsed.month !== monthDoc.month) {
      return {
        error: `date ${dateParsed.date} does not belong to ${monthDoc.year}-${String(monthDoc.month).padStart(2, "0")}`,
      };
    }

    if (seenDates.has(dateParsed.date)) {
      return { error: `duplicate date in request: ${dateParsed.date}` };
    }
    seenDates.add(dateParsed.date);

    if (
      !isWorkingDayKey(
        dateParsed.date,
        calendarContext.weeklyOffSet,
        calendarContext.holidayByDate,
      )
    ) {
      return {
        error: `Tour plans can only be saved on working days (${dateParsed.date})`,
      };
    }

    const validation = await validateDayPlanPayload({
      employee,
      areaIds: raw.areaIds,
      doctorIds: raw.doctorIds,
    });
    if (validation.error) {
      return { error: `${dateParsed.date}: ${validation.error}` };
    }

    normalizedDays.push({
      date: dateParsed.date,
      validation,
    });
  }

  for (const { date, validation } of normalizedDays) {
    monthDoc.days = (monthDoc.days || []).filter((d) => d.date !== date);
    if (!validation.clear) {
      monthDoc.days.push({
        date,
        areaIds: validation.areaIds,
        doctorIds: validation.doctorIds,
      });
    }
  }

  return { applied: normalizedDays.length };
};

export const getMyTourPlanMonth = async (req, res) => {
  try {
    const parsed = parseYearMonth(req.query.year, req.query.month);
    if (parsed.error) {
      return res.status(422).json({ success: false, message: parsed.error });
    }

    const { organizationId, employeeId } = orgAndEmployee(req);
    const { year, month } = parsed;

    const [calendarContext, monthDoc] = await Promise.all([
      loadMonthCalendarContext(organizationId, year, month),
      TourPlanMonth.findOne({ organizationId, employeeId, year, month }).lean(),
    ]);

    const data = await buildTourPlanMonthView({
      monthDoc: monthDoc ?? { organizationId, employeeId, year, month, days: [] },
      calendarContext,
      selectedDateHint: req.query.selectedDate,
      mode: "employee",
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getMyTourPlanMonth:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load tour plan",
    });
  }
};

export const getMyTourPlanDay = async (req, res) => {
  try {
    const dateInput = req.query.date ?? req.params.date;
    if (!dateInput) {
      return res.status(422).json({
        success: false,
        message: "date query parameter is required (YYYY-MM-DD)",
      });
    }

    const parsed = parseDateKey(String(dateInput).trim());
    if (parsed.error) {
      return res.status(422).json({ success: false, message: parsed.error });
    }

    const { organizationId, employeeId } = orgAndEmployee(req);
    const data = await getTourPlanDayForEmployee({
      organizationId,
      employeeId,
      visitDate: parsed.date,
    });

    if (data.error) {
      return res.status(422).json({ success: false, message: data.error });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("getMyTourPlanDay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load tour plan for date",
    });
  }
};

export const bulkUpsertMyTourPlanDays = async (req, res) => {
  try {
    const parsed = parseYearMonth(req.body.year, req.body.month);
    if (parsed.error) {
      return res.status(422).json({ success: false, message: parsed.error });
    }

    const { organizationId, employeeId } = orgAndEmployee(req);
    const { year, month } = parsed;

    const calendarContext = await loadMonthCalendarContext(
      organizationId,
      year,
      month,
    );

    const monthDoc = await findOrCreateMonthDoc({
      organizationId,
      employeeId,
      year,
      month,
    });

    if (!canEditTourPlan(monthDoc.status)) {
      return res.status(403).json({
        success: false,
        message: "This month's tour plan can no longer be edited",
      });
    }

    const applyResult = await applyDayInputsToMonthDoc({
      monthDoc,
      calendarContext,
      employee: req.employee,
      dayInputs: req.body.days,
    });
    if (applyResult.error) {
      return res.status(422).json({ success: false, message: applyResult.error });
    }

    resetRejectedToDraft(monthDoc);
    await monthDoc.save();

    const data = await buildTourPlanMonthView({
      monthDoc,
      calendarContext,
      selectedDateHint: req.body.selectedDate,
      mode: "employee",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        savedDaysCount: applyResult.applied,
      },
    });
  } catch (error) {
    console.error("bulkUpsertMyTourPlanDays:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save tour plan days",
    });
  }
};

export const upsertMyTourPlanDay = async (req, res) => {
  try {
    const dateParsed = parseDateKey(req.params.date);
    if (dateParsed.error) {
      return res.status(422).json({ success: false, message: dateParsed.error });
    }

    const { organizationId, employeeId } = orgAndEmployee(req);
    const { date, year, month } = dateParsed;

    const calendarContext = await loadMonthCalendarContext(
      organizationId,
      year,
      month,
    );

    if (
      !isWorkingDayKey(
        date,
        calendarContext.weeklyOffSet,
        calendarContext.holidayByDate,
      )
    ) {
      return res.status(422).json({
        success: false,
        message: "Tour plans can only be saved on working days",
      });
    }

    const monthDoc = await findOrCreateMonthDoc({
      organizationId,
      employeeId,
      year,
      month,
    });

    if (!canEditTourPlan(monthDoc.status)) {
      return res.status(403).json({
        success: false,
        message: "This month's tour plan can no longer be edited",
      });
    }

    const applyResult = await applyDayInputsToMonthDoc({
      monthDoc,
      calendarContext,
      employee: req.employee,
      dayInputs: [
        {
          date,
          areaIds: req.body.areaIds,
          doctorIds: req.body.doctorIds,
        },
      ],
    });
    if (applyResult.error) {
      return res.status(422).json({ success: false, message: applyResult.error });
    }

    resetRejectedToDraft(monthDoc);
    await monthDoc.save();

    const data = await buildTourPlanMonthView({
      monthDoc,
      calendarContext,
      selectedDateHint: date,
      mode: "employee",
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("upsertMyTourPlanDay:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save tour plan day",
    });
  }
};

export const copyPreviousMonthTourPlan = async (req, res) => {
  try {
    const parsed = parseYearMonth(
      req.body.year ?? req.query.year,
      req.body.month ?? req.query.month,
    );
    if (parsed.error) {
      return res.status(422).json({ success: false, message: parsed.error });
    }

    const overwrite = Boolean(req.body.overwrite);
    const { organizationId, employeeId } = orgAndEmployee(req);
    const { year, month } = parsed;
    const source = prevYearMonth(year, month);

    const [targetCalendar, sourceDoc, targetDocExisting] = await Promise.all([
      loadMonthCalendarContext(organizationId, year, month),
      TourPlanMonth.findOne({
        organizationId,
        employeeId,
        year: source.year,
        month: source.month,
      }).lean(),
      TourPlanMonth.findOne({ organizationId, employeeId, year, month }),
    ]);

    if (!sourceDoc?.days?.length) {
      return res.status(404).json({
        success: false,
        message: "No tour plan found for the previous month",
      });
    }

    let targetDoc = targetDocExisting;
    if (!targetDoc) {
      targetDoc = new TourPlanMonth({
        organizationId,
        employeeId,
        year,
        month,
        status: "draft",
        days: [],
      });
    }

    if (!canEditTourPlan(targetDoc.status)) {
      return res.status(403).json({
        success: false,
        message: "This month's tour plan can no longer be edited",
      });
    }

    const sourceByDayOfMonth = new Map();
    for (const day of sourceDoc.days) {
      const dp = parseDateKey(day.date);
      if (dp.error) continue;
      sourceByDayOfMonth.set(dp.day, day);
    }

    const targetPlanMap = dayPlanMapFromDoc(targetDoc);
    const skipped = [];
    const dayInputs = [];

    for (const cal of targetCalendar.days) {
      if (!cal.isSelectable) continue;
      const sourceDay = sourceByDayOfMonth.get(cal.dayOfMonth);
      if (!sourceDay || !isPlannedDay(sourceDay)) continue;

      const existing = targetPlanMap.get(cal.date);
      if (existing && isPlannedDay(existing) && !overwrite) {
        skipped.push({
          date: cal.date,
          reason: "already_planned",
        });
        continue;
      }

      const validation = await validateDayPlanPayload({
        employee: req.employee,
        areaIds: (sourceDay.areaIds || []).map(String),
        doctorIds: (sourceDay.doctorIds || []).map(String),
      });
      if (validation.error) {
        skipped.push({ date: cal.date, reason: validation.error });
        continue;
      }

      dayInputs.push({
        date: cal.date,
        areaIds: (sourceDay.areaIds || []).map(String),
        doctorIds: (sourceDay.doctorIds || []).map(String),
      });
    }

    const applyResult = await applyDayInputsToMonthDoc({
      monthDoc: targetDoc,
      calendarContext: targetCalendar,
      employee: req.employee,
      dayInputs,
    });
    if (applyResult.error) {
      return res.status(422).json({ success: false, message: applyResult.error });
    }

    resetRejectedToDraft(targetDoc);
    await targetDoc.save();

    const data = await buildTourPlanMonthView({
      monthDoc: targetDoc,
      calendarContext: targetCalendar,
      selectedDateHint: req.body.selectedDate ?? req.query.selectedDate,
      mode: "employee",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        copy: {
          copiedFrom: source,
          daysCopied: applyResult.applied,
          daysSkipped: skipped.length,
          skipped,
        },
      },
    });
  } catch (error) {
    console.error("copyPreviousMonthTourPlan:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to copy previous month tour plan",
    });
  }
};

export const submitMyTourPlanMonth = async (req, res) => {
  try {
    const parsed = parseYearMonth(
      req.body.year ?? req.query.year,
      req.body.month ?? req.query.month,
    );
    if (parsed.error) {
      return res.status(422).json({ success: false, message: parsed.error });
    }

    const { organizationId, employeeId } = orgAndEmployee(req);
    const { year, month } = parsed;

    const calendarContext = await loadMonthCalendarContext(
      organizationId,
      year,
      month,
    );

    const monthDoc = await findOrCreateMonthDoc({
      organizationId,
      employeeId,
      year,
      month,
    });

    if (!canEditTourPlan(monthDoc.status)) {
      return res.status(403).json({
        success: false,
        message: "This month's tour plan has already been submitted",
      });
    }

    if (req.body.days != null) {
      const applyResult = await applyDayInputsToMonthDoc({
        monthDoc,
        calendarContext,
        employee: req.employee,
        dayInputs: req.body.days,
      });
      if (applyResult.error) {
        return res.status(422).json({ success: false, message: applyResult.error });
      }
    }

    const planMap = dayPlanMapFromDoc(monthDoc);
    const validationWarnings = [];
    for (const cal of calendarContext.days) {
      if (!cal.isSelectable) continue;
      const plan = planMap.get(cal.date);
      if (!isPlannedDay(plan)) {
        validationWarnings.push({
          date: cal.date,
          message: "No plan for this working day",
        });
      }
    }

    monthDoc.status = "submitted";
    monthDoc.submittedAt = new Date();
    monthDoc.rejectionReason = null;
    monthDoc.reviewedBy = null;
    monthDoc.reviewedByRole = null;
    monthDoc.reviewedAt = null;
    await monthDoc.save();

    const data = await buildTourPlanMonthView({
      monthDoc,
      calendarContext,
      selectedDateHint: req.body.selectedDate,
      mode: "employee",
    });

    return res.status(200).json({
      success: true,
      data: {
        ...data,
        validationWarnings,
      },
    });
  } catch (error) {
    console.error("submitMyTourPlanMonth:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit tour plan",
    });
  }
};
