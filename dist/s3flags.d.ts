import { FlagCollection, FlagInfo, FlagInfoSlim, FlagValueTypes, S3FlagsConfig } from "./types";
export declare class S3Flags {
    readonly config: S3FlagsConfig;
    private s3;
    private cache;
    private refreshTimer;
    private optimizeTimer;
    constructor(config: S3FlagsConfig);
    init(): Promise<void>;
    destroy(): void;
    get<T extends FlagValueTypes>(flag: string, options: {
        default: T;
        env?: string;
    }): T;
    get<T extends FlagValueTypes>(flag: string, options: {
        info: true;
    }): FlagInfo<T> | null;
    on(flag: string, options?: {
        env?: string;
    }): boolean;
    all(): FlagCollection;
    all(options: {
        bypassCache: true;
    }): Promise<FlagCollection>;
    create<T extends FlagValueTypes>(flag: string, info: FlagInfoSlim<T>, user: string): Promise<void>;
    update(flag: string, value: string | number | boolean, user: string): Promise<void>;
    update(flag: string, env: string, value: string | number | boolean, user: string): Promise<void>;
    update<T extends FlagValueTypes>(flag: string, info: Partial<FlagInfoSlim<T>>, user: string): Promise<void>;
    delete(flag: string, user: string): Promise<void>;
    delete(flag: string, options: {
        permanent: true;
    }): Promise<void>;
    restore(flag: string): Promise<void>;
    refresh(): Promise<void>;
    optimize(): Promise<void>;
    private validateFlagInfoSlim(info);
    private validatePartialFlagInfoSlim(info);
    private getFlagsFromS3();
    private listFlagFiles();
    private getFlagFile(filename);
    private putFlagFile(filename, content);
    private deleteFlagFile(filename);
    private splitS3Location(location);
    private getTimestampFromFilename(filename);
    private generateUpdateFilename(timestamp?);
    private mergeFlagFiles(bundle, updates);
    private clone<T>(obj);
}
