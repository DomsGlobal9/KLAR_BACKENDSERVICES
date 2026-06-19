import mongoose from "mongoose";

export interface CreateRMInput {
    memberName: string;
    email: string;
    password: string;
    mobile: string;
    role: string;
    createdBy: string;
}

export interface UpdateRMInput {
    rmId: string;
    memberName?: string;
    email?: string;
    password?: string;
    mobile?: string;
    role?: string;
    status?: string;
    blockReason?: string;
    updatedBy: mongoose.Types.ObjectId;
}