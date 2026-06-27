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
    // assignedHeadQuarters

    if (req?.employee && !req?.employee?.assignedHeadQuarters?.length) {
      return res.status(200).json({
        success: false,
        message: "Headquarter not assigned to the employee",
      });
    }

    const filter = {
      organizationId: organizationId,
      ...(req?.employee?.assignedHeadQuarters?.length && {
        headQuarter: { $in: req?.employee?.assignedHeadQuarters },
      }),
    };

    const stockistOptions = await Stockist.find(filter, {
      _id: 1,
      name: 1,
    });

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

     const { name, state, address, headQuarter } = req.body;

    const filter = { organizationId };

    if (name?.trim())      filter.name      = { $regex: name.trim(), $options: "i" };
    if (state?.trim())     filter.state     = { $regex: state.trim(), $options: "i" };
    if (address?.trim())   filter.address   = { $regex: address.trim(), $options: "i" };
    if (headQuarter)       filter.headQuarter = headQuarter;

   

    const [stockist, stockistCount] = await Promise.all([
      Stockist.find(filter, {
        _id: 1,
        name: 1,
        address: 1,
        state: 1,
        headQuarter: 1,
      })
        .populate("headQuarter", "headQuarterName _id")
        .skip((pageNo - 1) * limit)
        .limit(limit),

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
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Stockist name is required",
      });
    }

    const updated = await Stockist.findOneAndUpdate(
      {
        _id: req.params.id,
        organizationId: req.organization._id,
      },
      { $set: { name: name.trim() } },
      { new: true, runValidators: true },
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Stockist not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Stockist updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error updating stockist:", err.message);
    res.status(500).json({
      success: false,
      message: "Could not update stockist, try again later",
    });
  }
};

export const deleteStockist = async (req, res) => {
  try {
    const deleted = await Stockist.findOneAndDelete({
      _id: req.params.id,
      organizationId: req?.organization?._id,  
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Stockist not found or access denied",
      });
    }

    res.status(200).json({
      success: true,
      message: "Stockist deleted successfully",
    });
  } catch (err) {
    console.error("Error deleting stockist:", err.message);
    res.status(500).json({
      success: false,
      message: "Could not delete stockist, try again later",
    });
  }
};


