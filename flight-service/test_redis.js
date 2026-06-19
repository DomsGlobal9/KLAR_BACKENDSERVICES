"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redisCache_service_1 = __importDefault(require("./src/cache/redisCache.service"));
async function run() {
    const data = await redisCache_service_1.default.get("a498b4cf-68cb-4757-8bba-b72131120c1e");
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
}
run();
