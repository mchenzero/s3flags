import { S3 } from "aws-sdk";
import { FlagCollection, FlagInfo, FlagInfoSlim, FlagValueTypes, S3FlagsConfig } from "./types";

export class S3Flags {
  private s3: S3;
  private cache: Cache;
  private refreshTimer: any;
  private optimizeTimer: any;

  constructor(public readonly config: S3FlagsConfig) {
    if (typeof config !== "object") {
      throw new Error("a configuration object must be provided");
    }

    if (!config.location) {
      throw new Error("s3 location must be provided");
    }

    if (!config.defaultEnv) {
      throw new Error("default environment must be provided");
    }

    if (config.optimizeInterval > 0 && !(config.optimizeDelay >= config.optimizeInterval)) {
      throw new Error("`optimizeDelay` should be greater than or equal to `optimizeInterval`");
    }

    this.s3 = new S3({
      accessKeyId: this.config.awsAccessKeyId,
      secretAccessKey: this.config.awsSecretAccessKey
    });

    this.cache = {
      files: {},
      bundle: null
    };
  }

  public async init(): Promise<void> {
    await this.refresh();

    if (this.config.refreshInterval > 0 && !this.refreshTimer) {
      // TODO: use an accurate timer
      this.refreshTimer = setInterval(
        () => {
          this.refresh();
          clearInterval(this.refreshTimer);
          this.refreshTimer = setInterval(() => this.refresh(), this.config.refreshInterval);
        },
        this.config.refreshInterval - Date.now() % this.config.refreshInterval
      );
    }

    if (this.config.optimizeInterval > 0 && !this.optimizeTimer) {
      // TODO: use an accurate timer
      this.optimizeTimer = setInterval(
        () => {
          this.optimize();
          clearInterval(this.optimizeTimer);
          this.optimizeTimer = setInterval(() => this.optimize(), this.config.optimizeInterval);
        },
        Math.floor(Math.random() * this.config.optimizeInterval)
      );
    }
  }

  public destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.optimizeTimer) {
      clearInterval(this.optimizeTimer);
      this.optimizeTimer = null;
    }
  }

  public get<T extends FlagValueTypes>(flag: string, options: { default: T, env?: string }): T;

  public get<T extends FlagValueTypes>(flag: string, options: { info: true }): FlagInfo<T> | null;

  public get(flag: string, options: any): any {
    if (!this.cache.bundle) {
      throw new Error("cannot get flag(s) before initialization completes");
    }

    const bundle = this.cache.bundle;

    if (!options) {
      options = {};
    }

    if (options.info) {
      return bundle[flag] || null;
    }

    const env = options.env || this.config.defaultEnv;

    if (bundle[flag] && (!bundle[flag].deletedAt) && bundle[flag].environments[env]) {
      return bundle[flag].environments[env].value;
    } else {
      return options.default;
    }
  }

  public on(flag: string, options: { env?: string } = {}): boolean {
    const result = this.get(flag, { default: false, env: options.env });
    if (typeof result === "boolean") {
      return result;
    } else {
      return false;
    }
  }

  public all(): FlagCollection;

  public all(options: { bypassCache: true }): Promise<FlagCollection>;

  public all(options: any = {}): any {
    if (options.bypassCache) {
      return this.getFlagsFromS3();
    }

    if (!this.cache.bundle) {
      throw new Error("cannot get flag(s) before initialization completes");
    }

    return this.clone(this.cache.bundle);
  }

  public async create<T extends FlagValueTypes>(flag: string, info: FlagInfoSlim<T>, user: string): Promise<void> {
    this.validateFlagInfoSlim(info);

    const timestamp = Date.now();
    const isoTimestamp = (new Date(timestamp)).toISOString();

    const filename = this.generateUpdateFilename(timestamp);
    const content: Update = {
      [flag]: {
        description: info.description,
        environments: Object.assign({}, ...Object.keys(info.environments).map(env => ({
          [env]: {
            value: info.environments[env].value
          }
        }))),
        tags: info.tags || [],
        createdAt: isoTimestamp,
        createdBy: user
      }
    };

    await this.putFlagFile(filename, content);
  }

  public update(flag: string, value: string | number | boolean, user: string): Promise<void>;

  public update(flag: string, env: string, value: string | number | boolean, user: string): Promise<void>;

  public update<T extends FlagValueTypes>(flag: string, info: Partial<FlagInfoSlim<T>>, user: string): Promise<void>;

  public async update(...args: any[]): Promise<void> {
    const flag: string = args.shift();
    const user: string = args.pop();

    const timestamp = Date.now();
    const isoTimestamp = (new Date(timestamp)).toISOString();

    const filename = this.generateUpdateFilename(timestamp);
    const content: Update = {};

    if (args.length === 1 && typeof args[0] === "object") {
      const info: Partial<FlagInfoSlim> = args[0];

      this.validatePartialFlagInfoSlim(info);

      content[flag] = {
        description: info.description,
        environments: info.environments && Object.assign({}, ...Object.keys(info.environments).map(env => ({
          [env]: {
            value: (info.environments as any)[env].value
          }
        }))),
        tags: info.tags,
        updatedAt: isoTimestamp,
        updatedBy: user
      };
    } else if (args.length === 1 || (args.length === 2 && typeof args[0] === "string")) {
      const env: string = (args.length === 2) ? args.shift() : this.config.defaultEnv;
      const value: string | number | boolean = args[0];

      if (["string", "number", "boolean"].indexOf(typeof value) < 0) {
        throw new Error("`value` should be a string, number or boolean");
      }

      content[flag] = {
        environments: {
          [env]: { value }
        },
        updatedAt: isoTimestamp,
        updatedBy: user
      };
    } else {
      throw new Error("invalid arguments");
    }

    await this.putFlagFile(filename, content);
  }

  public delete(flag: string, user: string): Promise<void>;

  public delete(flag: string, options: { permanent: true }): Promise<void>;

  public async delete(flag: string, arg1: any): Promise<void> {
    const timestamp = Date.now();
    const isoTimestamp = (new Date(timestamp)).toISOString();

    const filename = this.generateUpdateFilename(timestamp);
    const content: Update = {};

    if (typeof arg1 === "string") {
      content[flag] = {
        deletedAt: isoTimestamp,
        deletedBy: arg1
      };
    } else if (arg1 && arg1.permanent) {
      content[flag] = null;
    } else {
      throw new Error("invalid arguments");
    }

    await this.putFlagFile(filename, content);
  }

  public async restore(flag: string): Promise<void> {
    const filename = this.generateUpdateFilename();
    const content: Update = {
      deletedAt: null,
      deletedBy: null
    };
    await this.putFlagFile(filename, content);
  }

  public async refresh(): Promise<void> {
    this.cache.bundle = await this.getFlagsFromS3();
  }

  public async optimize(): Promise<void> {
    const optimizeDelay = this.config.optimizeDelay;

    const filenames = await this.listFlagFiles();
    const sortedBundleFilenames = filenames.filter(filename => filename.startsWith("bundle.")).sort();
    const sortedUpdateFilenames = filenames.filter(filename => filename.startsWith("update.")).sort();

    const latestBundleFilename = sortedBundleFilenames[sortedBundleFilenames.length - 1];
    const latestBundleFileTimestamp = this.getTimestampFromFilename(latestBundleFilename) || 0;

    const sortedUpdateFilenamesToBundle = sortedUpdateFilenames
      .filter(filename => {
        const timestamp = this.getTimestampFromFilename(filename) || 0;
        return timestamp > latestBundleFileTimestamp && Date.now() - timestamp >= optimizeDelay;
      });

    // create new bundle file if there's any updates to bundle
    if (sortedUpdateFilenamesToBundle.length > 0) {
      // load files to cache, if not already cached
      for (const filename of [latestBundleFilename].concat(sortedUpdateFilenamesToBundle)) {
        if (filename && !this.cache.files[filename]) {
          this.cache.files[filename] = await this.getFlagFile(filename);
        }
      }

      const oldBundle = this.cache.files[latestBundleFilename] as Bundle || {};
      const sortedUpdatesToBundle = sortedUpdateFilenames.map(filename => this.cache.files[filename] as Update);

      const newBundle = this.mergeFlagFiles(oldBundle, sortedUpdatesToBundle);

      const lastUpdateFilenameToBundle = sortedUpdateFilenamesToBundle[sortedUpdateFilenamesToBundle.length - 1];
      const newBundleTimestamp = this.getTimestampFromFilename(lastUpdateFilenameToBundle);
      const newBundleFilename = `bundle.${newBundleTimestamp}.json`;

      await this.putFlagFile(newBundleFilename, newBundle);

      this.cache.files[newBundleFilename] = newBundle;

      sortedBundleFilenames.push(newBundleFilename);
    }

    // clean up bundle files; keep no more than one bundle file that existed longer than optimizeDelay
    for (let i = 0; i < sortedBundleFilenames.length - 1; i++) {
      const nextFilename = sortedBundleFilenames[i + 1];
      const nextFileTimestamp = this.getTimestampFromFilename(nextFilename) || 0;
      // TODO: use a safe creation time check
      if (Date.now() - nextFileTimestamp >= optimizeDelay * 2) {
        await this.deleteFlagFile(sortedBundleFilenames[i]);
        sortedBundleFilenames.splice(i--, 1);
      }
    }

    // clean up update files (created at or earlier than timestamp of the first bundle file)
    const firstBundleFileTimestamp = this.getTimestampFromFilename(sortedBundleFilenames[0]) || 0;
    for (let i = 0; i < sortedUpdateFilenames.length; i++) {
      const filename = sortedUpdateFilenames[i];
      const timestamp = this.getTimestampFromFilename(filename) || 0;
      if (timestamp <= firstBundleFileTimestamp) {
        await this.deleteFlagFile(filename);
        sortedUpdateFilenames.splice(i--, 1);
      }
    }
  }

  private validateFlagInfoSlim(info: FlagInfoSlim): void {
    if (typeof info.description === "undefined") {
      throw new Error("`description` is required");
    }

    if (typeof info.description !== "string") {
      throw new Error("`description` should be a string");
    }

    if (typeof info.environments !== "object") {
      throw new Error("`environments` should be an object");
    } else {
      for (const env of Object.keys(info.environments)) {
        if (typeof info.environments[env] !== "object") {
          throw new Error(`\`environments["${env}"]\` should be an object`);
        }
      }

      const valueTypes = Array.from(new Set(
        Object.keys(info.environments).map(env => typeof info.environments[env].value)
      ));

      if (valueTypes.length === 0) {
        throw new Error("`environments` should contain at least one environment");
      }

      if (valueTypes.length > 1) {
        throw new Error("`value` should be of the same type for all environments");
      }

      if (["string", "number", "boolean"].indexOf(valueTypes[0]) < 0) {
        throw new Error("`value` should be a string, number or boolean");
      }
    }

    if (typeof info.tags !== "undefined" && !Array.isArray(info.tags)) {
      throw new Error("`tags` should be an array");
    }

    if (Array.isArray(info.tags) && info.tags.filter(t => typeof t !== "string").length > 0) {
      throw new Error("`tags` should contain only string members");
    }
  }

  private validatePartialFlagInfoSlim(info: Partial<FlagInfoSlim>): void {
    if (typeof info.description !== "undefined" && typeof info.description !== "string") {
      throw new Error("`description` should be a string");
    }

    if (typeof info.environments !== "undefined" && typeof info.environments !== "object") {
      throw new Error("`environments` should be an object");
    }

    if (info.environments) {
      for (const env of Object.keys(info.environments)) {
        if (typeof info.environments[env] !== "object") {
          throw new Error(`\`environments["${env}"]\` should be an object`);
        }
      }

      const valueTypes = Array.from(new Set(
        Object.keys(info.environments).map(env => typeof (info.environments as any)[env].value)
      ));

      if (valueTypes.length > 1) {
        throw new Error("`value` should be of the same type for all environments");
      }

      if (valueTypes.length === 1 && ["string", "number", "boolean"].indexOf(valueTypes[0]) < 0) {
        throw new Error("`value` should be a string, number or boolean");
      }
    }

    if (typeof info.tags !== "undefined" && !Array.isArray(info.tags)) {
      throw new Error("`tags` should be an array");
    }

    if (Array.isArray(info.tags) && info.tags.filter(t => typeof t !== "string").length > 0) {
      throw new Error("`tags` should contain only string members");
    }
  }

  private async getFlagsFromS3(): Promise<FlagCollection> {
    const filenames = await this.listFlagFiles();

    // clean up obsolete files from cache
    for (const filename of Object.keys(this.cache.files)) {
      if (filenames.indexOf(filename) < 0) {
        delete this.cache.files[filename];
      }
    }

    const latestBundleFilename = filenames.filter(filename => filename.startsWith("bundle.")).sort().reverse()[0];
    const latestBundleFileTimestamp = this.getTimestampFromFilename(latestBundleFilename) || 0;

    const sortedUpdateFilenames = filenames
      .filter(filename => filename.startsWith("update."))
      .filter(filename => {
        const timestamp = this.getTimestampFromFilename(filename) || 0;
        return timestamp > latestBundleFileTimestamp;
      })
      .sort();

    // load files to cache, if not already cached
    for (const filename of [latestBundleFilename].concat(sortedUpdateFilenames)) {
      if (filename && !this.cache.files[filename]) {
        this.cache.files[filename] = await this.getFlagFile(filename);
      }
    }

    const bundle = this.cache.files[latestBundleFilename] as Bundle || {};
    const updates = sortedUpdateFilenames.map(filename => this.cache.files[filename] as Update);

    return this.mergeFlagFiles(bundle, updates);
  }

  private async listFlagFiles(): Promise<string[]> {
    const { bucket, prefix } = this.splitS3Location(this.config.location);

    let filenames: string[] = [];

    for (let continuationToken: any; ; ) {
      const params = { Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken };
      const response = await this.s3.listObjectsV2(params).promise();

      if (response.Contents) {
        filenames = filenames.concat(
          response.Contents
            .map(obj => (obj.Key || "").slice(prefix.length))
            .filter(filename => /^(bundle|update)\.\d+(\.[a-z\d]+)?\.json$/.test(filename)
        ));
      }

      if (response.NextContinuationToken) {
        continuationToken = response.NextContinuationToken;
      } else {
        break;
      }
    }

    return filenames;
  }

  private async getFlagFile(filename: string): Promise<File> {
    const { bucket, prefix } = this.splitS3Location(this.config.location);

    const response = await this.s3.getObject({ Bucket: bucket, Key: prefix + filename }).promise();

    if (!response.Body) {
      throw new Error(`unable to get content of s3 file "${filename}"`);
    }

    return JSON.parse((response.Body as Buffer).toString());
  }

  private async putFlagFile(filename: string, content: File): Promise<void> {
    const { bucket, prefix } = this.splitS3Location(this.config.location);
    const body = JSON.stringify(content, null, 2);
    await this.s3.putObject({ Bucket: bucket, Key: prefix + filename, Body: body }).promise();
  }

  private async deleteFlagFile(filename: string): Promise<void> {
    const { bucket, prefix } = this.splitS3Location(this.config.location);
    await this.s3.deleteObject({ Bucket: bucket, Key: prefix + filename }).promise();
  }

  private splitS3Location(location: string): { bucket: string, prefix: string } {
    const matches = /^(.*?)(?:\/(.*))?$/.exec(location) || [];
    const bucket = matches[1] || "";
    const prefix = (matches[2] || "").replace(/^(.+?)\/*$/, "$1/");
    return { bucket, prefix };
  }

  private getTimestampFromFilename(filename: string): number | null {
    const matches = /^(?:bundle|update)\.(\d+)(?:\.[a-z\d]+)?\.json$/.exec(filename);
    if (matches) {
      return parseInt(matches[1]);
    } else {
      return null;
    }
  }

  private generateUpdateFilename(timestamp?: number): string {
    if (!timestamp) {
      timestamp = Date.now();
    }
    return `update.${timestamp}.${Math.floor(2821109907456 * Math.random()).toString(36)}.json`;
  }

  private mergeFlagFiles(bundle: Bundle, updates: Update[]): Bundle {
    const mergeResult = this.clone(bundle);

    for (const update of updates) {
      for (const flag of Object.keys(update)) {
        const info = update[flag];

        // permanent delete
        if (info === null) {
          delete mergeResult[flag];
          continue;
        }

        // soft delete
        if (info.deletedAt) {
          if (mergeResult[flag] && !mergeResult[flag].deletedAt) {
            mergeResult[flag].deletedAt = info.deletedAt;
            mergeResult[flag].deletedBy = info.deletedBy || "";
          }
          continue;
        }

        // restore
        if (info.deletedAt === null) {
          if (mergeResult[flag] && mergeResult[flag].deletedAt) {
            mergeResult[flag].deletedAt = null;
            mergeResult[flag].deletedBy = null;
          }
          continue;
        }

        // create
        if (info.createdAt) {
          if (!mergeResult[flag]) {
            mergeResult[flag] = {
              description: info.description || "",
              environments: Object.assign({}, ...Object.keys(info.environments || {}).map(env => ({
                [env]: {
                  value: (info.environments as any)[env].value,
                  updatedAt: info.createdAt,
                  updatedBy: info.createdBy || ""
                }
              }))),
              tags: info.tags || [],
              createdAt: info.createdAt,
              createdBy: info.createdBy || "",
              updatedAt: info.createdAt,
              updatedBy: info.createdBy || "",
              deletedAt: null,
              deletedBy: null
            };
          }
          continue;
        }

        // update
        if (info.updatedAt) {
          if (mergeResult[flag] && !mergeResult[flag].deletedAt) {
            let changed = false;

            if (typeof info.description === "string" && info.description !== mergeResult[flag].description) {
              mergeResult[flag].description = info.description;
              changed = true;
            }

            if (info.environments) {
              for (const env of Object.keys(info.environments)) {
                if (info.environments[env].value !== mergeResult[flag].environments[env].value) {
                  mergeResult[flag].environments[env] = {
                    value: info.environments[env].value,
                    updatedAt: info.updatedAt,
                    updatedBy: info.updatedBy || ""
                  };
                  changed = true;
                }
              }
            }

            if (Array.isArray(info.tags)) {
              const tags = info.tags.filter(t => typeof t === "string");
              if (JSON.stringify(tags) !== JSON.stringify(mergeResult[flag].tags)) {
                mergeResult[flag].tags = tags;
                changed = true;
              }
            }

            if (changed) {
              mergeResult[flag].updatedAt = info.updatedAt;
              mergeResult[flag].updatedBy = info.updatedBy || "";
            }
          }
          continue;
        }
      }
    }

    return mergeResult;
  }

  private clone<T extends object>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

interface Cache {
  files: { [name: string]: File };
  bundle: Bundle | null;
}

interface Bundle {
  [flag: string]: FlagInfo;
}

interface Update {
  [flag: string]: null | {
    description?: string;
    environments?: {
      [env: string]: {
        value: FlagValueTypes;
      };
    };
    tags?: string[];
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    deletedAt?: string | null;
    deletedBy?: string | null;
  };
}

type File = Bundle | Update;
