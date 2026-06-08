// import { Request, Response } from "express";
// import { applyVisaService } from "../services/visa-services";

// import Visa from "../model/visa-model"; // ✅ REQUIRED

// export const applyVisaController = async (req: Request, res: Response) => {
//   try {
//     const visa = await applyVisaService(req.body);

//     res.status(201).json({
//       success: true,
//       message: "Visa application submitted successfully",
//       data: visa,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error submitting visa",
//       error,
//     });
//   }
// };


// // GET ALL VISAS
// export const getAllVisas = async (req: Request, res: Response) => {
//   try {
//     const visas = await Visa.find();

//     res.status(200).json({
//       success: true,
//       data: visas,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// // GET VISAS BY TYPE


// export const getVisaByType = async (req: Request, res: Response) => {
//   try {
//     const { type } = req.params;

//     console.log("TYPE:", type); // debug

//     const visas = await Visa.find({
//       visaType: type.toUpperCase(),
//     });

//     res.status(200).json({
//       success: true,
//       count: visas.length,
//       data: visas,
//     });
//   } catch (error) {
//     console.error("ERROR:", error); // VERY IMPORTANT
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// // export const getVisaByType = async (req: Request, res: Response) => {
// //   try {
// //     const { type } = req.params;

// //     const visas = await Visa.find({
// //       visaType: type.toUpperCase(),
// //     });

// //     res.status(200).json({
// //       success: true,
// //       data: visas,
// //     });
// //   } catch (error) {
// //     res.status(500).json({
// //       success: false,
// //       message: "Server error",
// //     });
// //   }
// // };

// //GET SINGLE VISA (by ID)

// export const getVisaById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const visa = await Visa.findById(id);

//     if (!visa) {
//       return res.status(404).json({
//         success: false,
//         message: "Visa not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: visa,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// import { Request, Response } from "express";
// import mongoose from "mongoose";
// import { applyVisaService } from "../services/visa-services";

// import Visa from "../model/visa-model"; // ✅ REQUIRED

// export const applyVisaController = async (req: Request, res: Response) => {
//   try {
//     const visa = await applyVisaService(req.body);

//     res.status(201).json({
//       success: true,
//       message: "Visa application submitted successfully",
//       data: visa,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Error submitting visa",
//       error,
//     });
//   }
// };


// // GET ALL VISAS
// export const getAllVisas = async (req: Request, res: Response) => {
//   try {
//     const visas = await Visa.find();

//     res.status(200).json({
//       success: true,
//       data: visas,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// // GET VISAS BY TYPE

// export const getVisaByType = async (req: Request, res: Response) => {
//   try {
//     const { type } = req.params;

//     console.log("TYPE:", type); // debug

//     const visas = await Visa.find({
//       visaType: type.toUpperCase(),
//     });

//     res.status(200).json({
//       success: true,
//       count: visas.length,
//       data: visas,
//     });
//   } catch (error) {
//     console.error("ERROR:", error); // VERY IMPORTANT
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// // GET SINGLE VISA (by ID)

// export const getVisaById = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     const visa = await Visa.findById(id);

//     if (!visa) {
//       return res.status(404).json({
//         success: false,
//         message: "Visa not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       data: visa,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };


// // DELETE VISA API

// export const deleteVisa = async (req: Request, res: Response) => {
//   try {
//     const { id } = req.params;

//     // ✅ Validate MongoDB ObjectId
//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid visa ID",
//       });
//     }

//     const deletedVisa = await Visa.findByIdAndDelete(id);

//     if (!deletedVisa) {
//       return res.status(404).json({
//         success: false,
//         message: "Visa not found",
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: "Visa deleted successfully",
//       data: deletedVisa,
//     });
//   } catch (error) {
//     console.error("DELETE ERROR:", error);

//     res.status(500).json({
//       success: false,
//       message: "Server error",
//     });
//   }
// };

import { Request, Response } from "express";
import mongoose from "mongoose";
import { applyVisaService } from "../services/visa-services";

import Visa from "../model/visa-model"; // ✅ REQUIRED

export const applyVisaController = async (req: Request, res: Response) => {
  try {
    const visa = await applyVisaService(req.body);

    res.status(201).json({
      success: true,
      message: "Visa application submitted successfully",
      data: visa,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error submitting visa",
      error,
    });
  }
};


// GET ALL VISAS
export const getAllVisas = async (req: Request, res: Response) => {
  try {
    const visas = await Visa.find();

    res.status(200).json({
      success: true,
      data: visas,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// GET VISAS BY TYPE

export const getVisaByType = async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    console.log("TYPE:", type); // debug

    const visas = await Visa.find({
      visaType: type.toUpperCase(),
    });

    res.status(200).json({
      success: true,
      count: visas.length,
      data: visas,
    });
  } catch (error) {
    console.error("ERROR:", error); // VERY IMPORTANT
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// GET SINGLE VISA (by ID)

export const getVisaById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const visa = await Visa.findById(id);

    if (!visa) {
      return res.status(404).json({
        success: false,
        message: "Visa not found",
      });
    }

    res.status(200).json({
      success: true,
      data: visa,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// DELETE VISA API

export const deleteVisa = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ✅ Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visa ID",
      });
    }

    const deletedVisa = await Visa.findByIdAndDelete(id);

    if (!deletedVisa) {
      return res.status(404).json({
        success: false,
        message: "Visa not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Visa deleted successfully",
      data: deletedVisa,
    });
  } catch (error) {
    console.error("DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


// UPDATE VISA API

export const updateVisa = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // ✅ Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid visa ID",
      });
    }

    const updatedVisa = await Visa.findByIdAndUpdate(
      id,
      req.body,
      {
        new: true, // return updated document
        runValidators: true,
      }
    );

    if (!updatedVisa) {
      return res.status(404).json({
        success: false,
        message: "Visa not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Visa updated successfully",
      data: updatedVisa,
    });
  } catch (error) {
    console.error("UPDATE ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};