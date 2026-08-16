import Zone from "../models/Zone.js";
export const getAllZoneOptions = async (req, res) => {
  try {
    const organizationId = req?.organization?.id;

    const zoneOptions = await Zone.find(
      { organizationId },
      { _id: 1, name: 1 },
    );

    res.status(200).json({
      success: true,
      data: zoneOptions,
    });
  } catch (error) {
    console.error("Error in getting zone options", error);
    res.status(500).json({
      success: false,
      message: "Problem in fetching all zones. Pls try again later",
    });
  }
};
