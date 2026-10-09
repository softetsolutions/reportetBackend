import fs from "fs";
import ExcelJS from "exceljs";
import OrgHoliday from "../models/OrgHoliday.js";
import { getCellStringValue } from "../utils/helperFunction.js";
import {
  INDIA_PRESET_ID,
  buildIndiaHolidayPreset,
  listIndiaHolidayPresetMeta,
} from "../utils/indiaHolidayPresets.js";

const orgIdFromReq = (req) => req.organization._id || req.organization.id;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const normalizeHolidayInput = (date, name) => {
  const d = String(date || "").trim();
  const n = String(name || "").trim();
  if (!DATE_RE.test(d)) {
    return { error: "date must be YYYY-MM-DD" };
  }
  if (!n) {
    return { error: "name is required" };
  }
  const [y, m, day] = d.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, day));
  if (
    parsed.getUTCFullYear() !== y ||
    parsed.getUTCMonth() !== m - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { error: `invalid calendar date: ${d}` };
  }
  return { date: d, name: n };
};

/**
 * Upsert many holidays. overwrite=false skips existing dates.
 */
export const upsertHolidayBatch = async ({
  organizationId,
  holidays,
  overwrite = true,
}) => {
  const created = [];
  const updated = [];
  const skipped = [];
  const errors = [];

  for (const raw of holidays) {
    const normalized = normalizeHolidayInput(raw.date, raw.name);
    if (normalized.error) {
      errors.push({ date: raw.date, name: raw.name, reason: normalized.error });
      continue;
    }

    const existing = await OrgHoliday.findOne({
      organizationId,
      date: normalized.date,
    }).lean();

    if (existing && !overwrite) {
      skipped.push({
        date: normalized.date,
        name: existing.name,
        reason: "already exists",
      });
      continue;
    }

    const holiday = await OrgHoliday.findOneAndUpdate(
      { organizationId, date: normalized.date },
      { $set: { name: normalized.name } },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    if (existing) updated.push(holiday);
    else created.push(holiday);
  }

  return { created, updated, skipped, errors };
};

export const downloadHolidayTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Holidays");
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Name", key: "name", width: 32 },
    ];
    sheet.addRow({ date: "2026-01-26", name: "Republic Day" });
    sheet.addRow({ date: "2026-08-15", name: "Independence Day" });
    sheet.addRow({ date: "2026-10-02", name: "Gandhi Jayanti" });
    sheet.getRow(1).font = { bold: true };

    const note = workbook.addWorksheet("Instructions");
    note.addRow(["Use columns Date (YYYY-MM-DD) and Name."]);
    note.addRow(["One holiday per row. Existing dates will be updated on import."]);
    note.addRow(["Delete the sample rows before uploading if not needed."]);

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="holiday-template.xlsx"',
    );
    return res.status(200).send(Buffer.from(buffer));
  } catch (error) {
    console.error("downloadHolidayTemplate:", error);
    res.status(500).json({ success: false, message: "Failed to create template" });
  }
};

const excelDateToKey = (value) => {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const asString = getCellStringValue(value);
  if (DATE_RE.test(asString)) return asString;
  // Excel serial number
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const parsed = new Date(asString);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return asString;
};

export const importHolidaysFromExcel = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const organizationId = orgIdFromReq(req);
    if (!filePath) {
      return res.status(422).json({
        success: false,
        message: "Excel file is required (field name: file)",
      });
    }

    const overwrite = req.body?.overwrite !== "false" && req.body?.overwrite !== false;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet =
      workbook.getWorksheet("Holidays") || workbook.worksheets[0];
    if (!worksheet) {
      return res.status(422).json({
        success: false,
        message: "No worksheet found in the Excel file",
      });
    }

    const headerRow = worksheet.getRow(1);
    const headers = {};
    headerRow.eachCell((cell, col) => {
      headers[String(getCellStringValue(cell.value)).trim().toLowerCase()] = col;
    });

    const dateCol = headers.date;
    const nameCol = headers.name;
    if (!dateCol || !nameCol) {
      return res.status(422).json({
        success: false,
        message: 'Excel must have header columns "Date" and "Name"',
      });
    }

    const holidays = [];
    const rowErrors = [];
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return;
      const dateRaw = row.getCell(dateCol).value;
      const nameRaw = row.getCell(nameCol).value;
      const date = excelDateToKey(dateRaw);
      const name = getCellStringValue(nameRaw);
      if (!date && !name) return;
      const normalized = normalizeHolidayInput(date, name);
      if (normalized.error) {
        rowErrors.push({ row: rowNumber, date, name, reason: normalized.error });
        return;
      }
      holidays.push(normalized);
    });

    if (!holidays.length && !rowErrors.length) {
      return res.status(422).json({
        success: false,
        message: "No holiday rows found in the file",
      });
    }

    const result = await upsertHolidayBatch({
      organizationId,
      holidays,
      overwrite,
    });

    res.status(200).json({
      success: true,
      message: "Holiday import completed",
      created: result.created.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: [...rowErrors, ...result.errors],
      holidays: [...result.created, ...result.updated],
    });
  } catch (error) {
    console.error("importHolidaysFromExcel:", error);
    res.status(500).json({ success: false, message: "Failed to import holidays" });
  } finally {
    if (filePath) {
      fs.unlink(filePath, () => {});
    }
  }
};

export const bulkCreateHolidays = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { holidays, overwrite = true } = req.body || {};
    if (!Array.isArray(holidays) || !holidays.length) {
      return res.status(422).json({
        success: false,
        message: "holidays must be a non-empty array of { date, name }",
      });
    }

    const result = await upsertHolidayBatch({
      organizationId,
      holidays,
      overwrite: Boolean(overwrite),
    });

    res.status(200).json({
      success: true,
      message: "Bulk holidays saved",
      created: result.created.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors,
      holidays: [...result.created, ...result.updated],
    });
  } catch (error) {
    console.error("bulkCreateHolidays:", error);
    res.status(500).json({ success: false, message: "Failed to bulk save holidays" });
  }
};

export const copyHolidaysYear = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { fromYear, toYear, overwrite = false } = req.body || {};
    const from = Number(fromYear);
    const to = Number(toYear);

    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 2000 ||
      to < 2000 ||
      from > 2100 ||
      to > 2100
    ) {
      return res.status(422).json({
        success: false,
        message: "fromYear and toYear must be valid years",
      });
    }
    if (from === to) {
      return res.status(422).json({
        success: false,
        message: "fromYear and toYear must be different",
      });
    }

    const source = await OrgHoliday.find({
      organizationId,
      date: { $gte: `${from}-01-01`, $lte: `${from}-12-31` },
    })
      .sort({ date: 1 })
      .lean();

    if (!source.length) {
      return res.status(404).json({
        success: false,
        message: `No holidays found for year ${from}`,
      });
    }

    const mapped = source.map((h) => ({
      date: `${to}-${h.date.slice(5)}`,
      name: h.name,
    }));

    const result = await upsertHolidayBatch({
      organizationId,
      holidays: mapped,
      overwrite: Boolean(overwrite),
    });

    res.status(200).json({
      success: true,
      message: `Copied holidays from ${from} to ${to}`,
      warning:
        "Festival dates (Diwali, Holi, Eid, etc.) often change by year. Review and adjust movable holidays after copy.",
      fromYear: from,
      toYear: to,
      sourceCount: source.length,
      created: result.created.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors,
      holidays: [...result.created, ...result.updated],
    });
  } catch (error) {
    console.error("copyHolidaysYear:", error);
    res.status(500).json({ success: false, message: "Failed to copy holidays" });
  }
};

export const listHolidayPresets = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      presets: [listIndiaHolidayPresetMeta()],
    });
  } catch (error) {
    console.error("listHolidayPresets:", error);
    res.status(500).json({ success: false, message: "Failed to list presets" });
  }
};

export const applyHolidayPreset = async (req, res) => {
  try {
    const organizationId = orgIdFromReq(req);
    const { packId = INDIA_PRESET_ID, year, overwrite = false } = req.body || {};
    const y = Number(year);

    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return res.status(422).json({
        success: false,
        message: "year is required",
      });
    }
    if (packId !== INDIA_PRESET_ID) {
      return res.status(422).json({
        success: false,
        message: `Unknown packId. Supported: ${INDIA_PRESET_ID}`,
      });
    }

    const preset = buildIndiaHolidayPreset(y);
    const result = await upsertHolidayBatch({
      organizationId,
      holidays: preset.holidays,
      overwrite: Boolean(overwrite),
    });

    res.status(200).json({
      success: true,
      message: `Applied preset ${packId} for ${y}`,
      packId,
      year: y,
      hasYearPack: preset.hasYearPack,
      warning: preset.warning,
      created: result.created.length,
      updated: result.updated.length,
      skipped: result.skipped.length,
      errors: result.errors,
      holidays: [...result.created, ...result.updated],
    });
  } catch (error) {
    console.error("applyHolidayPreset:", error);
    res.status(500).json({ success: false, message: "Failed to apply preset" });
  }
};

export const previewHolidayPreset = async (req, res) => {
  try {
    const { packId = INDIA_PRESET_ID, year } = req.query;
    const y = Number(year);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
      return res.status(422).json({
        success: false,
        message: "year query param is required",
      });
    }
    if (packId !== INDIA_PRESET_ID) {
      return res.status(422).json({
        success: false,
        message: `Unknown packId. Supported: ${INDIA_PRESET_ID}`,
      });
    }
    const preset = buildIndiaHolidayPreset(y);
    res.status(200).json({ success: true, ...preset });
  } catch (error) {
    console.error("previewHolidayPreset:", error);
    res.status(500).json({ success: false, message: "Failed to preview preset" });
  }
};

// re-export normalize for tests
export { normalizeHolidayInput };
