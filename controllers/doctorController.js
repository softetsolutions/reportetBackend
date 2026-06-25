import Doctor from "../models/Doctor.js";
import fs from "fs";
import ExcelJS from "exceljs";
import Area from "../models/Area.js";
import { getCellStringValue } from "../utils/helperFunction.js";

export const addDoctor = async (req, res) => {
  try {
    // const sampleDoctorDataStructure = {
    //   "Mr Satyam Tripathi": {
    //     specialty:"",
    //     areaId:"",
    //     headQuarterId:""
    //   }
    // }

    const { doctorData } = req.body;

    const doctorArray = Object.keys(doctorData).map((doctor) => ({
      name: doctor,
      specialty: doctorData[doctor]?.specialty,
      organizationId: req?.organization._id,
      areaId: doctorData[doctor]?.areaId,
    }));

    const dbAcknowledge = await Doctor.insertMany(doctorArray, {
      ordered: false,
    });

    res.status(201).json({
      success: true,
      inserted: dbAcknowledge,
      message: "Doctor are added successfuly",
    });
  } catch (error) {
    if (error.code === 11000 || error.writeErrors) {
      const insertedCount = error.result?.nInserted || 0;

      return res.status(201).json({
        success: true,
        inserted: insertedCount,
        duplicates: error.writeErrors?.length || 0,
        message: "Some records were skipped because they already exist",
      });
    }

    res.status(500).json({
      message: "Failed to add doctors",
      error: error.message,
    });
  }
};

export const getDoctorsByAreaId = async (req, res) => {
  try {
    const { areaId } = req.params;

    const doctors = await Doctor.find({ areaId }).select("name specialty _id");

    if (doctors.length === 0) {
      return res
        .status(404)
        .json({ message: "No doctors found for this area" });
    }

    res.status(200).json(doctors);
  } catch (error) {
    res.status(500).json({
      message: "Failed to retrieve doctors by area",
      error: error.message,
    });
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const pageNo = Number(req.body.pageNo) || 1;
    const limit = Number(req.body.limit) || 5;

    const filter = {
      organizationId: req?.organization?.id,
    };

    const [doctors, totalDoctorCount] = await Promise.all([
      Doctor.find(
        filter,
        {
          _id: 1,
          name: 1,
          specialty: 1,
        },
        {
          skip: (pageNo - 1) * limit,
          limit,
        },
      ),
      Doctor.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      doctors,
      doctorsCount: totalDoctorCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve doctors",
      error: error.message,
    });
  }
};

export const importDoctorsFromExcel = async (req, res) => {
  try {
    const filePath = req.file.path;
    const {
      // sheetNo = 1,
      // rowNumber = 4,
      // areaColumnName = "Area",
      // doctorColumnName = "DR LIST",
      sheetNo = 6,
      rowNumber = 2,
      areaColumnName = "Area",
      doctorColumnName = "DR LIST",
    } = req?.body;
    const organizationId = req?.organization?._id;

    const escapeRegex = (value) =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.worksheets[sheetNo];

    if (!worksheet) {
      throw new Error("Invalid sheet number");
    }

    let headers = [];
    const areaDoctorMap = {};

    worksheet.eachRow({ includeEmpty: false }, (row, number) => {
      if (number < rowNumber) return;
      const doctorName = getCellStringValue(row?.values[2]);
      const areaName = getCellStringValue(row?.values[3]);
      const speciality = getCellStringValue(row?.values[4]);
      const category = getCellStringValue(row?.values[5]) || "-";

      if (!doctorName || !areaName) return;
      if (number < rowNumber) return;
      if (!doctorName) return;

      if (areaDoctorMap[areaName]) {
        areaDoctorMap[areaName]?.push({
          name: doctorName,
          specialty: speciality,
          category: category,
          areaId: areaName,
          organizationId: organizationId,
        });
      } else {
        areaDoctorMap[areaName] = [
          {
            name: doctorName,
            specialty: speciality,
            category: category,
            areaId: areaName,
            organizationId: organizationId,
          },
        ];
      }
    });

    const areasToFind = Object.keys(areaDoctorMap).map((areaName) => ({
      name: {
        $regex: new RegExp(`^${escapeRegex(areaName.trim())}$`, "i"),
      },
    }));

    const areaWithIds = await Area?.find({
      organizationId,
      $or: areasToFind,
    }).select("_id name");

    const areaAndAreaIdMap = areaWithIds?.reduce((acc, area) => {
      const areaName = area?.name?.toUpperCase();
      acc[areaName] = area?._id;
      return acc;
    }, {});

    const doctorsDetailInsertionPayload = Object.values(areaDoctorMap).reduce(
      (acc, doctorDetail) => {
        doctorDetail?.forEach((element) => {
          let id = areaAndAreaIdMap[element?.areaId?.toUpperCase()];
          acc.push({
            ...element,
            areaId: id,
          });
        });
        return acc;
      },
      [],
    );

    const insertDoctors = await Doctor.insertMany(
      doctorsDetailInsertionPayload,
      { ordered: false },
    );

    res.status(200).json({
      success: true,
      data: insertDoctors,
      message: `doctors imported successfully.`,
    });
  } catch (err) {
    console.error("Excel Import Error:", err);
    res
      .status(500)
      .json({ message: "Failed to import doctors from Excel file." });
  }
};
