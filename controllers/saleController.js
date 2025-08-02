import Sale from '../models/Sale.js';

export const createSale = async (req, res) => {
  try {
    const sale = await Sale.create(req.body);
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getAllSales = async (req, res) => {
  const search = req.query.search || "";
  const sales = await Sale.find()
    .populate('stockist')
    .where('stockist.name')
    .regex(new RegExp(search, 'i'));
  res.json(sales);
};

export const updateSale = async (req, res) => {
  try {
    const sale = await Sale.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteSale = async (req, res) => {
  try {
    await Sale.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
