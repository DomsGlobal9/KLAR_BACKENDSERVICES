import { Request, Response, NextFunction } from "express";
import {
  getPendingVerificationsService,
  approveVerificationService,
  rejectVerificationService,
} from "../services/adminVerification.service";

export const getPendingVerifications = async (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await getPendingVerificationsService();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const approveVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await approveVerificationService(req.params.userId);
    res.json({ message: "Verification approved" });
  } catch (err) {
    next(err);
  }
};

export const rejectVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { remarks } = req.body;
    await rejectVerificationService(req.params.userId, remarks);
    res.json({ message: "Verification rejected" });
  } catch (err) {
    next(err);
  }
};
