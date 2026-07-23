import { Request, Response, NextFunction } from "express";
import { CompanyService } from "../services/company.service";
import { OTPService } from "../services/otp.service";
import { OTPType } from "../models/otp.model";
import { Roles } from "../constants/roles";

export const createCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            businessName,
            businessType,
            contactPerson,
            businessEmail,
            businessMobile,
            password,
            gstNumber,
            gstRegisteredName,
            gstEmail,
            gstMobile,
            gstAddress,
            panNumber,
            address,
            city,
            country,
            limit,
        } = req.body;

        if (!businessName) {
            return res.status(400).json({
                success: false,
                message: "Business name is required",
            });
        }

        if (!businessType) {
            return res.status(400).json({
                success: false,
                message: "Business type is required",
            });
        }

        if (!contactPerson) {
            return res.status(400).json({
                success: false,
                message: "Contact person is required",
            });
        }

        if (!businessEmail) {
            return res.status(400).json({
                success: false,
                message: "Business email is required",
            });
        }

        if (!businessMobile) {
            return res.status(400).json({
                success: false,
                message: "Business mobile is required",
            });
        }

        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required",
            });
        }

        if (!address) {
            return res.status(400).json({
                success: false,
                message: "Address is required",
            });
        }

        if (!city) {
            return res.status(400).json({
                success: false,
                message: "City is required",
            });
        }

        if (!country) {
            return res.status(400).json({
                success: false,
                message: "Country is required",
            });
        }

        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(businessEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        await CompanyService.validateCompanyCreation(businessEmail);

        await OTPService.generateOTP(
            businessEmail.toLowerCase(),
            OTPType.SIGNUP
        );

        res.locals.companyData = {
            businessName,
            businessType,
            contactPerson,
            businessEmail: businessEmail.toLowerCase(),
            businessMobile,
            password,
            gstNumber,
            gstRegisteredName,
            gstEmail: gstEmail?.toLowerCase(),
            gstMobile,
            gstAddress,
            panNumber,
            address,
            city,
            country,
            limit,
        };

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            data: {
                email: businessEmail,
            },
        });

    } catch (err) {
        next(err);
    }
};

export const verifyCreateCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const {
            businessName,
            businessType,
            contactPerson,
            businessEmail,
            businessMobile,
            password,
            gstNumber,
            gstRegisteredName,
            gstEmail,
            gstMobile,
            gstAddress,
            panNumber,
            address,
            city,
            country,
            limit,
            otp,
        } = req.body;

        if (!businessName || !businessType || !contactPerson ||
            !businessEmail || !businessMobile || !password ||
            !address || !city || !country || !otp) {
            return res.status(400).json({
                success: false,
                message: "All fields including OTP are required",
            });
        }

        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(businessEmail)) {
            return res.status(400).json({
                success: false,
                message: "Invalid email format",
            });
        }

        
        await OTPService.verifyOTP(
            businessEmail.toLowerCase(),
            otp,
            OTPType.SIGNUP
        );

        
        const currentUser = (req as any).user;

        
        const result = await CompanyService.createSubCompany({
            businessName,
            businessType,
            contactPerson,
            businessEmail: businessEmail.toLowerCase(),
            businessMobile,
            password,
            gstNumber,
            gstRegisteredName,
            gstEmail: gstEmail?.toLowerCase(),
            gstMobile,
            gstAddress,
            panNumber,
            address,
            city,
            country,
            limit,
            createdBy: currentUser.userId,
        });

        return res.status(201).json({
            success: true,
            message: "Sub-company created successfully",
            data: result,
        });

    } catch (err) {
        next(err);
    }
};

export const getAllCompanies = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const currentUser = (req as any).user;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = req.query.search as string;
        const status = req.query.status as string;

        const result = await CompanyService.getAllSubCompanies(
            currentUser.userId,
            page,
            limit,
            search,
            status
        );

        return res.status(200).json({
            success: true,
            message: "Sub-companies retrieved successfully",
            data: result.data,
            pagination: result.pagination,
        });

    } catch (err) {
        next(err);
    }
};

export const getCompanyById = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { companyId } = req.params;
        const currentUser = (req as any).user;

        const company = await CompanyService.getSubCompanyById(
            companyId as string,
            currentUser.userId
        );

        return res.status(200).json({
            success: true,
            message: "Sub-company retrieved successfully",
            data: company,
        });

    } catch (err) {
        next(err);
    }
};

export const updateCompany = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const { companyId } = req.params;
        const currentUser = (req as any).user;
        const updateData = req.body;

        const result = await CompanyService.updateSubCompany(
            companyId as string,
            currentUser.userId,
            updateData
        );

        return res.status(200).json({
            success: true,
            message: "Sub-company updated successfully",
            data: result,
        });

    } catch (err) {
        next(err);
    }
};