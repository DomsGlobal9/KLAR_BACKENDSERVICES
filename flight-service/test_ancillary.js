"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const ancillary_service_1 = __importDefault(require("./src/services/ancillary.service"));
const mongoose_1 = __importDefault(require("mongoose"));
async function run() {
    await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/klar");
    try {
        const SESSION = "aac65e7e-ac63-4916-9f09-0352d5828b2a"; // Or whatever is latest. Let's get it from redis
        import RedisCacheService from "./src/cache/redisCache.service";
        const res = await ancillary_service_1.default.getAncillaries(process.argv[2]);
        console.log(JSON.stringify(res, null, 2));
    }
    catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
