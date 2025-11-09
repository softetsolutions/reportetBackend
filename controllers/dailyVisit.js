



import DailyVisit from "../models/Daily-Visit.js";

// Create Daily Visit
export const createDailyVisit = async (req, res) => {
  try {
    const { date, areaId, doctorId, remark } = req.body;
    const mrId = req.mr._id;

    if (!date || !areaId || !doctorId || !mrId || !remark) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const dailyVisit = await DailyVisit.create({
      date,
      areaId,
      doctorId,
      mrId,
      remark,
    });

    res.status(201).json({
      message: "Daily visit created successfully",
      dailyVisit,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to create daily visit",
      error: error.message,
    });
  }
};

// Get Doctors with Remarks
export const getDoctorsWithRemarks = async (req, res) => {
  try {
    const { mrId, areaId, startDate, endDate } = req.query;

    if (!mrId || !areaId || !startDate || !endDate) {
      return res.status(400).json({
        message: "mrId, areaId, startDate, and endDate are required",
      });
    }

    const visits = await DailyVisit.find({
      mrId,
      areaId,
      date: { $gte: new Date(startDate), $lte: new Date(endDate) },
    })
      .populate("doctorId", "name _id")
      .select("doctorId remark -_id");

    if (!visits.length) {
      return res.status(404).json({ message: "No visits found" });
    }

    res.status(200).json(visits);
  } catch (err) {
    console.error("failed to fetch visit",err.message);
    res.status(500).json({
      message: "Failed to retrieve doctors with remarks",
      error: err.message,
    });
  }
};












// import DailyVisit from "../models/Daily-Visit.js";


// export const createDailyVisit = async (req, res) => {
//   try {
//     const { date, areaId, doctorId, remark } = req.body;
//     const mrId = req.mr._id; 
//     if (!date || !areaId || !doctorId || !mrId || !remark) {
//       return res.status(400).json({ message: 'All fields are required' });
//     }

//     const dailyVisit = await DailyVisit.create({
//       date,
//       areaId,
//       doctorId,
//       mrId,
//       remark,
//     });
//     res.status(201).json({ message: 'Daily visit created successfully', dailyVisit });
//   } catch (error) {
//     res.status(500).json({ message: 'Failed to create daily visit', error: error.message });
//   }
// }

// export const getDoctorsWithRemarks = async (req, res) => {
//   try {
//     const { mrId, areaId, startDate, endDate } = req.query;

//     if (!mrId || !areaId || !startDate || !endDate) {
//       return res.status(400).json({ message: "mrId, areaId, startDate, and endDate are required" });
//     }

//     const visits = await DailyVisit.find({
//       mrId,
//       areaId,
//       date: {
//         $gte: new Date(startDate),
//         $lte: new Date(endDate)
//       }
//     })
//     .populate("doctorId", "name _id").select("doctorId remark -_id"); 

//     if (!visits.length) {
//       return res.status(404).json({ message: "No visits found" });
//     }

//     res.status(200).json(visits);

//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to retrieve doctors with remarks",
//       error: error.message
//     });
//   }
// };
