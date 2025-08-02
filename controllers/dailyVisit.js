import DailyVisit from "../models/Daily-Visit.js";


export const createDailyVisit = async (req, res) => {
  try {
    const { date, areaId, doctorId, remark } = req.body;
    const mrId = req.mr._id; 
    if (!date || !areaId || !doctorId || !mrId || !remark) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const dailyVisit = await DailyVisit.create({
      date,
      areaId,
      doctorId,
      mrId,
      remark,
    });
    res.status(201).json({ message: 'Daily visit created successfully', dailyVisit });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create daily visit', error: error.message });
  }
}