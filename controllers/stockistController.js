import Stockist from "../models/Stockist.js";

export const createStockist = async (req, res) => {
  try {
    const { name, address, state, gstNo } = req.body;
    const stockist = await Stockist.create({
      name,
      address,
      state,
      gstNumber: gstNo,
      organizationId: req.organization._id,
    });
    res.status(201).json(stockist);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAllStockists = async (req, res) => {
  try {
    const organizationId = req.organization._id;
    const stockists = await Stockist.find({
      organizationId: organizationId,
    });
    res.json(stockists);
  } catch (err) {
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
