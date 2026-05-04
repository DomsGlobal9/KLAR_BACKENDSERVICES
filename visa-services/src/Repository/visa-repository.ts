import Visa from "../model/visa-model";

export const createVisa = async (data: any) => {
  return await Visa.create(data);
};