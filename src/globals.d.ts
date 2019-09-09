declare type LogEventLevel = "DEBUG" | "ACCESS" | "INFO" | "WARN" | "ERROR" | "FATAL";
declare type LogEvent = (date: Date, level: LogEventLevel, message: string) => void;
declare type LogMessageData = any[];

interface AppConfig {
    env: "production" | "development";

    dbPath: string;

    webLocation: string | number;
    webDomain: string;

    discordAppID: string;
    discordAppSecret: string;
    discordAppRedirect: string;
    discordBotToken: string;

    nsfwLowThreshold: number;
    nsfwHighThreshold: number;
}

interface UserEntry {
    discordID: string;
    discordToken: string;
    discordRefresh: string;
    vanisToken: string;
    moderator: boolean;
    bannedUntil: Date;
}
declare type UserDocument = import("mongoose").Document & UserEntry;

interface SkinEntry {
    skinID: string;
    ownerID: string;
    skinName: string;
    status: SkinStatus;
}
declare type SkinStatus = "pending" | "rejected" | "approved";
declare type SkinDocument = import("mongoose").Document & SkinEntry;

interface DiscordResponse {
    error?: string;
    error_description?: string;
}
interface DiscordAuthorization {
    access_token: string;
    refresh_token: string;
}
interface DiscordUser {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    locale: string;
}

interface VanisLoginInfo {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    moderator: boolean;
    bannedUntil: Date;
}

interface NSFWPrediction {
    drawing: number;
    hentai: number;
    neutral: number;
    porn: number;
    sexy: number;
}

declare type APIRequest = import("express").Request & {
    vanisPermissions: number;
    vanisUser?: UserDocument;
};
declare type APIResponse = import("express").Response;

interface APIEndpointHandler {
    handler(this: import("./app"), req: APIRequest, res: APIResponse): void;
    method: "get" | "post" | "patch" | "put" | "delete" | "head" | "options" | "use";
    path: string;
    pre: Array<import("express").Handler>;
}
