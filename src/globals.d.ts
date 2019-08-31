declare type LogEventLevel = "DEBUG" | "ACCESS" | "INFO" | "WARN" | "ERROR" | "FATAL";
declare type LogEvent = (date: Date, level: LogEventLevel, message: string) => void;
declare type LogMessageData = any[];

interface AppConfig {
    env: "production" | "development";

    dbPath: string;

    webLocation: string | number;
    webDomain: string;

    discordAppId: string;
    discordAppSecret: string;
    discordAppRedirect: string;
    discordBotToken: string;
}

interface UserEntry {
    discordID: string;
    discordToken: string;
    vanisToken: string;
}
declare type UserDocument = import("mongoose").Document & UserEntry;

interface SkinEntry {
    skinID: string;
    ownerID: string;
    createdStamp: Date;
    approvedStamp?: Date;
}
declare type SkinDocument = import("mongoose").Document & SkinEntry;

interface APIEndpointHandler {
    handler(this: import("./App"), req: import("express").Request, res: import("express").Response): void;
    method: "get" | "post" | "patch" | "put" | "delete" | "head" | "options";
    path: string;
};
