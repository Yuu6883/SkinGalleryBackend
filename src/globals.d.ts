declare type LogEventLevel = "DEBUG" | "ACCESS" | "INFO" | "WARN" | "ERROR" | "FATAL";
declare type LogEvent = (date: Date, level: LogEventLevel, message: string) => void;
declare type LogMessageData = any[];

interface AppConfig {
    env: "production" | "development";
    dbPath: string;
    httpLocation: string | number;
    discordToken: string;
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
