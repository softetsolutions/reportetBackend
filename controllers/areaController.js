import Area from "../models/Area.js";
import Mr from "../models/Mr.js";
import fs from 'fs';
import ExcelJS from 'exceljs';

export const addArea = async (req, res) => {
  try {
    const { names } = req.body;

    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: "Please provide an array of area names." });
    }

    const uniqueNames = [...new Set(names)];

    // Find existing areas for the current organization
    const existingAreas = await Area.find({
      name: { $in: uniqueNames },
      organizationId: req.organization._id,
    });

    const existingNames = existingAreas.map(area => area.name);

    // Filter only new area names
    const namesToInsert = uniqueNames.filter(name => !existingNames.includes(name));

    let insertedAreas = [];
    if (namesToInsert.length > 0) {
      const areasToCreate = namesToInsert.map(name => ({
        name,
        organizationId: req.organization._id,
      }));
      insertedAreas = await Area.insertMany(areasToCreate);
    }

    res.status(201).json({
      message: "Areas processed successfully.",
      inserted: insertedAreas,
      skipped: existingNames,
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to add areas",
      error: error.message,
    });
  }
};


export const assignAreaToMR = async (req, res) => {
  try {
    const { mrId, areaId } = req.body;
    if (!mrId || !areaId) {
      return res.status(400).json({ message: "mrId and areaId are required" });
    }

    const user = await Mr.findOne({
      _id: mrId,
      organizationId: req.organization._id,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.assignedAreas.push(areaId);
    await user.save();

    res.json(user);
  } catch (error) {
    res.status(500).json({
      message: "Failed to assign area to MR",
      error: error.message,
    });
  }
};

export const getAreas = async (req, res) => {
  try {
    const areas = await Area.find({ organizationId: req.organization._id }).select("name _id");
    if (areas.length === 0) {
      return res.status(404).json({ message: "No areas found" });
    }
    res.json(areas);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve areas", error: error.message });
  }
};

export const getAreaById = async (req, res) => {
  try {
    const area = await Area.findById(req.params.id).select("name _id");
    if (!area) {
      return res.status(404).json({ message: "Area not found" });
    }
    res.json(area);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to retrieve area", error: error.message });
  }
};

export const importAreasFromExcel = async (req, res) => {
  try {
    const filePath = req.file.path;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);

    let importedCount = 0;

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const name = row.getCell(1).value?.toString().trim();

      if (!name) continue;

      const existing = await Area.findOne({ name, organizationId: req.organization._id });
      if (!existing) {
        await Area.create({ name, organizationId: req.organization._id });
        importedCount++;
      }
    }

    fs.unlinkSync(filePath);

    res.status(200).json({ message: `${importedCount} areas imported successfully.` });
  } catch (err) {
    console.error('Area Import Error:', err);
    res.status(500).json({ message: 'Failed to import areas from Excel file.' });
  }
};

export const getAreaByMrId = async (req, res) => {
  try {
    const { mrId } = req.params;

    // If logged in as MR
    if (req.mr) {
      // MR can access their own areas only
      if (req.mr._id.toString() !== mrId) {
        return res.status(403).json({ message: "Forbidden: Cannot access other MR's areas" });
      }
      const selfMr = await Mr.findById(mrId).populate('assignedAreas', 'name _id');
      return res.status(200).json(selfMr.assignedAreas || []);
    }

    // If logged in as Organization
    if (req.organization) {
      const mr = await Mr.findOne({ _id: mrId, organizationId: req.organization._id })
        .populate('assignedAreas', 'name _id');

      if (!mr) {
        return res.status(404).json({ message: "MR not found or no assigned areas" });
      }

      return res.status(200).json(mr.assignedAreas || []);
    }

    res.status(401).json({ message: "Unauthorized" });
  } catch (error) {
    console.error("Get Areas by MR ID Error:", error);
    res.status(500).json({ message: "Failed to retrieve areas", error: error.message });
  }
};

