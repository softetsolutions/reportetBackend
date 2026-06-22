import Stockist from "../models/Stockist.js";

export const createStockist = async (req, res) => {
  try {
    const { name, address, state, headQuarter } = req.body;
    const stockist = await Stockist.create({
      name,
      address,
      state,
      headQuarter,
      organizationId: req.organization._id,
    });
    res.status(201).json({
      success: true,
      added: stockist,
    });
  } catch (err) {
    console.error("Got error in creating stockist", err);
    res.status(400).json({ error: err.message });
  }
};

export const getStockistOptions = async (req, res) => {
  try {
    const organizationId =
      req?.employee?.organizationId ?? req.organization?.id;

    if (!organizationId) {
      throw new Error("Organization id is not defined");
    }

    const stockistOptions = await Stockist.find(
      { organizationId: organizationId },
      {
        _id: 1,
        name: 1,
      },
    );

    res.json({
      success: true,
      data: stockistOptions,
    });
  } catch (error) {
    console.error("Unable to get stockist options", error);
    res.json({
      success: false,
      message: "Unable to get stockist options",
    });
  }
};

export const getAllStockists = async (req, res) => {
  try {
    const pageNo = Number(req?.body?.pageNo) || 1;
    const limit = Number(req?.body?.limit) || 10;
    const organizationId =
      req.organization?._id || req.employee?.organizationId;

    if (!organizationId) {
      return res.status(400).json({ message: "Organization ID not found" });
    }

    const filter = {
      organizationId: organizationId,
    };

    const [stockist, stockistCount] = await Promise.all([
      Stockist.find(filter, {
        _id: 1,
        name: 1,
        address: 1,
        state: 1,
        headQuarter: 1,
      }).populate("headQuarter", "headQuarterName _id"),
      Stockist.countDocuments(filter),
    ]);

    res.status(201).json({
      success: true,
      data: stockist,
      stockistCount,
    });
  } catch (err) {
    console.error("getAllStockists Error:", err.message);
    res.status(400).json({ error: err.message });
  }
};
export const updateStockist = async (req, res) => {
  try {
    const stockist = await Stockist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(stockist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteStockist = async (req, res) => {
  try {
    await Stockist.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
