declare type LogEventLevel = "DEBUG" | "ACCESS" | "INFO" | "PRINT" | "WARN" | "ERROR" | "FATAL" | "TEST";
declare type LogEvent = (date: Date, level: LogEventLevel, message: string) => void;
declare type LogMessageData = any[];

interface AppConfig {
    env: "production" | "development";

    dbPath: string;

    webLocation: string | number;
    webDomain:   string;

    discordAppID:       string;
    discordAppSecret:   string;
    discordAppRedirect: string;
    discordBotToken:    string;
    userinfoCacheTime:  number;

    publicUpdateInterval: string;
    publicPageLimit: string;
    cfToken: string;
    cfZone:  string;

    skinLimit: number;
    nsfwLowThreshold:  number;
    nsfwHighThreshold: number;
    skinApprovedChannelID: string;
    skinPendingChannelID:  string;
    skinRejectedChannelID: string;
    skinDeletedChannelID:  string;
    notifChannelID:        string;
    debugChannelID:        string;
    approveEmoji: string;
    rejectEmoji:  string;
    approveThreshold: number;
    rejectThreshold:  number;
    reviewInterval:   number;
    admins: string[];
    prefix: string;
}

interface UserEntry {
    discordID:      string;
    discordToken:   string;
    discordRefresh: string;
    vanisToken:     string;
    cacheTimestamp: number;
    cacheInfo:      Map<string, string>;
    moderator:      boolean;
    bannedUntil:    Date;
    favorites:      string[];
}
declare type UserDocument = import("mongoose").Document & UserEntry;

interface SkinEntry {
    skinID:    string;
    ownerID:   string;
    skinName:  string;
    status:    SkinStatus;
    public:    boolean;
    favorites: number;
    tags:      string[];
    createdAt: Number;
}

interface ClientSkin {
    ownerID:   string;
    skinID:    string;
    status:    SkinStatus;
    skinName:  boolean;
    public:    boolean;
    createdAt: number;
    favorites: number;
    tags:      string[];
}

declare type ClientSkinWithHash = ClientSkin & { hash: string };

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
    avarage_color: string;
    color_STD: string;
}

declare type APIRequest = import("express").Request & {
    vanisPermissions: number;
    vanisUser?: UserDocument;
};
declare type APIResponse = import("express").Response;

interface APIEndpointHandler {
    handler(this: import("./src/app"), req: APIRequest, res: APIResponse): void;
    method: "get" | "post" | "patch" | "put" | "delete" | "head" | "options" | "use";
    path: string;
    pre: Array<import("express").Handler>;
}
