import mongoose, { Types } from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";
import Employee from "../models/Employee.js";

export const addHeadquarter = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { hierrarchy } = req.body;
    if (!hierrarchy?.headquarters?.length) {
      res.json({
        success: false,
        message: "Empty headquarter",
      });
    }

    const result = await session.withTransaction(async () => {
      const headquarters = await HeadQuarter.insertMany(
        hierrarchy.headquarters,
      );
      const areas = hierrarchy?.areas?.length
        ? await Area.insertMany(hierrarchy?.areas)
        : [];
      const doctor = hierrarchy?.doctors?.length
        ? await Doctor.insertMany(hierrarchy?.doctors)
        : [];
    });

    res.json({
      success: true,
      message: "Hierarchy added successfully",
      result: result,
    });
  } catch (error) {
    console.error("Transaction is aborted due to the", error.message);
    res.json({
      success: false,
      message: "Transaction is aborted, try again later",
    });
  } finally {
    await session.endSession();
  }
};

export const fetchHeadquarterData = async (req, res) => {
  try {
    let { pageNo = 1, limit = 5 } = req.body;
    limit = Number(limit);

     const { headQuarterName, location } = req.body;

    const matchFilter = {
      organizationId: new Types.ObjectId(req?.organization?.id),
    };

    if (headQuarterName?.trim()) {
      matchFilter.headQuarterName = { $regex: headQuarterName.trim(), $options: "i" };
    }
    if (location?.trim()) {
      matchFilter.location = { $regex: location.trim(), $options: "i" };
    }

    const headQuartersDetails = await HeadQuarter.aggregate([
      {
        $facet: {
          headQuarterDetail: [
            {
              $match: 
                matchFilter,
              
            },
            {
              $sort: {
                _id: -1,
              },
            },
            {
              $skip: (pageNo - 1) * limit,
            },
            {
              $limit: limit,
            },
            {
              $project: {
                _id: 1,
                headQuarterName: 1,
                location: 1,
                organizationId: 1,
              },
            },
            {
              $lookup: {
                from: "areas",
                localField: "_id",
                foreignField: "headQuarterId",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                    },
                  },
                ],
                as: "areas",
              },
            },
            {
              $lookup: {
                from: "doctors",
                localField: "areas._id",
                foreignField: "areaId",
                pipeline: [
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                      specialty: 1,

                      areaId: 1,
                    },
                  },
                ],
                as: "allDoctors",
              },
            },
          ],

          totalCount: [
            {
              $match: 
                 matchFilter
              
            },
            {
              $count: "totalHeadquarters",
            },
          ],
        },
      },
    ]);

    res.json({
      success: true,
      data: headQuartersDetails,
    });
  } catch (error) {
    console.error("Unable to fetch the headQuarters", error.message);
    res.json({
      success: false,
      message: "Can not fetch the headquarter details",
    });
  }
};

export const getAllHeadQuartersName = async (req, res) => {
  try {
    const headQuarter = await HeadQuarter.find(
      {
        organizationId: req?.organization?.id,
      },
      {
        _id: 1,
        headQuarterName: 1,
      },
    );
    res.json({
      status: true,
      headQuarterNames: headQuarter,
    });
  } catch (error) {
    console.error("Unable to fetch the headquarter names", error.message);
    res.json({
      success: false,
      message:
        "Unable to fetch the headquarters names, pls try again after sometime",
    });
  }
};

export const getEmployeeHeadQuarter = async (req, res) => {
  try {
    if (req?.employee) {
      if (!req?.employee?.assignedHeadQuarters?.length) {
        res.status(200).json({
          success: true,
          assignedHeadQuarters: [],
        });
      }

      const assignedHeadQuarters = await HeadQuarter.find(
        {
          _id: { $in: req?.employee?.assignedHeadQuarters },
        },
        {
          _id: 1,
          headQuarterName: 1,
          location: 1,
        },
      );

      res.status(200).json({
        success: true,
        assignedHeadQuarters: assignedHeadQuarters,
      });
    } else {
      const { employeeId } = req?.body;

      const employeeDetail = await Employee.find(
        {
          id: employeeId,
        },
        {
          _id: 0,
          firstName: 0,
          lastName: 0,
          userName: 0,
          employeeId: 0,
          email: 0,
          phoneNumber: 0,
          password: 0,
          role: 0,
          organizationId: 0,
          assignedAreas: 0,
          assignedDoctors: 0,
          createdAt: 0,
          updatedAt: 0,
          __v: 0,
        },
      ).populate("assignedHeadQuarters", "_id headQuarterName location");

      res.status(200).json({
        success: true,
        assignedHeadQuarters: employeeDetail?.assignedHeadQuarters,
      });
    }
  } catch (error) {
    console.error("Error in get Headquarter name of an employee", error);
    res.json({
      success: false,
      message: "Can not fetch headquarters, try again later",
    });
  }
};



export const editHeadquarter = async (req, res) => {
  try {
    const { headquarterId } = req.params;
    const { headQuarterName, location } = req.body;

    if (!headquarterId) {
      return res.status(400).json({
        success: false,
        message: "Headquarter ID is required",
      });
    }

    if (!headQuarterName && !location) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const updateFields = {};
    if (headQuarterName) updateFields.headQuarterName = headQuarterName;
    if (location) updateFields.location = location;

    
    const updated = await HeadQuarter.findOneAndUpdate(
      {
        _id: headquarterId,
        organizationId: req?.organization?.id, 
      },
      { $set: updateFields },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Headquarter not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Headquarter updated successfully",
      data: updated,
    });
  } catch (error) {
   
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A headquarter with this name already exists in your organization",
      });
    }
    console.error("Error updating headquarter:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not update headquarter, try again later",
    });
  }
};

export const deleteHeadquarter = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { headquarterId } = req.params;

    if (!headquarterId) {
      return res.status(400).json({
        success: false,
        message: "Headquarter ID is required",
      });
    }

    await session.withTransaction(async () => {
      
      const deleted = await HeadQuarter.findOneAndDelete(
        {
          _id: headquarterId,
          organizationId: req?.organization?.id,
        },
        { session },
      );

      if (!deleted) {
        
        const err = new Error("Headquarter not found or access denied");
        err.statusCode = 404;
        throw err;
      }

      
      const areaIds = await Area.find(
        { headQuarterId: headquarterId },
        { _id: 1 },
        { session },
      ).then((docs) => docs.map((d) => d._id));

      if (areaIds.length) {
        await Area.deleteMany({ _id: { $in: areaIds } }, { session });
        await Doctor.deleteMany({ areaId: { $in: areaIds } }, { session });
      }
    });

    res.status(200).json({
      success: true,
      message: "Headquarter and all related data deleted successfully",
    });
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }
    console.error("Error deleting headquarter:", error.message);
    res.status(500).json({
      success: false,
      message: "Could not delete headquarter, try again later",
    });
  } finally {
    await session.endSession();
  }
};