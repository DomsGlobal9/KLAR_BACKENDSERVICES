import { Request, Response, NextFunction } from "express";
import { ClientType } from "../constants/clientTypes";


export interface ContextRequest extends Request {
    clientType?: ClientType;
}

export const contextResolver = (
    req: ContextRequest,
    _res: Response,
    next: NextFunction
) => {

    console.log("========== CONTEXT RESOLVER ==========");
    console.log("Original URL:", req.originalUrl);
    console.log("Path:", req.path);

    const segments = req.path.split("/").filter(Boolean);

    console.log("Segments:", segments);

    if (segments[0] === "health" || segments[0] === "admin") {
        console.log("Skipping context resolver");
        return next();
    }

    const client = segments.find(seg =>
        seg === ClientType.B2C ||
        seg === ClientType.B2B ||
        seg === ClientType.USER ||
        seg === ClientType.B2B2B
    );

    console.log("Detected Client:", client);

    if (client) {
        req.clientType = client as ClientType;

        console.log("Client Type Set:", req.clientType);
        console.log("====================================");

        return next();
    }

    console.log("No valid client type found");
    console.log("====================================");

    return next(new Error(`Invalid client type`));
};














// export interface ContextRequest extends Request {
//     clientType?: ClientType;
// }

// export const contextResolver = (
//     req: ContextRequest,
//     _res: Response,
//     next: NextFunction
// ) => {
//     const segments = req.path.split("/").filter(Boolean);

//     if (segments[0] === "health" || segments[0] === "admin") {
//         return next();
//     }

//     const client = segments.find(seg =>
//         seg === ClientType.B2C ||
//         seg === ClientType.B2B ||
//         seg === ClientType.USER ||
//         seg === ClientType.B2B2B
//     );

//     if (client) {
//         req.clientType = client as ClientType;
//         return next();
//     }

//     return next(new Error(`Invalid client type #################`));
// };