// import { createVisaApplication } from "../Repository/visa-repository";
// import { IIndividualVisa } from "../interface/visa-interface";

// export const applyVisaService = async (data: IIndividualVisa) => {
//   return await createVisaApplication(data);
// };



// import { createVisaApplication } from "../Repository/visa-repository";
// import { IVisa } from "../interface/visa-interface";

// export const applyVisaService = async (data: IVisa) => {
//   // 🔥 Basic validation for FAMILY
//   if (data.visaType === "FAMILY") {
//     if (!data.numAdults || !data.numChildren) {
//       throw new Error("Family visa requires adult & children count");
//     }
//   }

//   return await createVisaApplication(data);
// };


import { createVisa } from "../Repository/visa-repository";

export const applyVisaService = async (data: any) => {
  return await createVisa(data);
};