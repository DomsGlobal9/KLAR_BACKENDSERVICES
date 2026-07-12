import { envConfig } from "./env.config";

export const cronConfig = {
    enabled: envConfig.CRON_ENABLED === "true",
};

export const CRON_TIME = {
    EVERY_30_SECONDS: "*/30 * * * * *",
    
    EVERY_1_MINUTE: "* * * * *",

    EVERY_2_MINUTES: "*/2 * * * *",

    EVERY_5_MINUTES: "*/5 * * * *",

    EVERY_10_MINUTES: "*/10 * * * *",

    EVERY_30_MINUTES: "*/30 * * * *",

    EVERY_HOUR: "0 * * * *",

    EVERY_DAY_MIDNIGHT: "0 0 * * *",

    EVERY_DAY_1_AM: "0 1 * * *",

    EVERY_SUNDAY_MIDNIGHT: "0 0 * * 0",

    EVERY_MONTH_FIRST_DAY: "0 0 1 * *",
};