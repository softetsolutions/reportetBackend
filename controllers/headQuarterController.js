import mongoose, { Types } from "mongoose";
import HeadQuarter from "../models/HeadQuarter.js";
import Area from "../models/Area.js";
import Doctor from "../models/Doctor.js";

export const addHeadquarter = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { hierrarchy } = req.body;
    console.log("hierrarchy is", hierrarchy);
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
    const headQuartersDetails = await HeadQuarter.aggregate([
      {
        $facet: {
          headQuarterDetail: [
            {
              $match: {
                organizationId: new Types.ObjectId(req?.organization?.id),
              },
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
              $match: {
                organizationId: new Types.ObjectId(req?.organization?.id),
              },
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
