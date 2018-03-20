"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const aws_sdk_1 = require("aws-sdk");
class S3Flags {
    constructor(config) {
        this.config = config;
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
        this.s3 = new aws_sdk_1.S3({
            accessKeyId: this.config.awsAccessKeyId,
            secretAccessKey: this.config.awsSecretAccessKey
        });
        this.cache = {
            files: {},
            bundle: null
        };
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.refresh();
            if (this.config.refreshInterval > 0 && !this.refreshTimer) {
                // TODO: use an accurate timer
                this.refreshTimer = setInterval(() => {
                    this.refresh();
                    clearInterval(this.refreshTimer);
                    this.refreshTimer = setInterval(() => this.refresh(), this.config.refreshInterval);
                }, this.config.refreshInterval - Date.now() % this.config.refreshInterval);
            }
            if (this.config.optimizeInterval > 0 && !this.optimizeTimer) {
                // TODO: use an accurate timer
                this.optimizeTimer = setInterval(() => {
                    this.optimize();
                    clearInterval(this.optimizeTimer);
                    this.optimizeTimer = setInterval(() => this.optimize(), this.config.optimizeInterval);
                }, Math.floor(Math.random() * this.config.optimizeInterval));
            }
        });
    }
    destroy() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
        if (this.optimizeTimer) {
            clearInterval(this.optimizeTimer);
            this.optimizeTimer = null;
        }
    }
    get(flag, options) {
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
        }
        else {
            return options.default;
        }
    }
    on(flag, options = {}) {
        const result = this.get(flag, { default: false, env: options.env });
        if (typeof result === "boolean") {
            return result;
        }
        else {
            return false;
        }
    }
    all(options = {}) {
        if (options.bypassCache) {
            return this.getFlagsFromS3();
        }
        if (!this.cache.bundle) {
            throw new Error("cannot get flag(s) before initialization completes");
        }
        return this.clone(this.cache.bundle);
    }
    create(flag, info, user) {
        return __awaiter(this, void 0, void 0, function* () {
            this.validateFlagInfoSlim(info);
            const timestamp = Date.now();
            const isoTimestamp = (new Date(timestamp)).toISOString();
            const filename = this.generateUpdateFilename(timestamp);
            const content = {
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
            yield this.putFlagFile(filename, content);
        });
    }
    update(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const flag = args.shift();
            const user = args.pop();
            const timestamp = Date.now();
            const isoTimestamp = (new Date(timestamp)).toISOString();
            const filename = this.generateUpdateFilename(timestamp);
            const content = {};
            if (args.length === 1 && typeof args[0] === "object") {
                const info = args[0];
                this.validatePartialFlagInfoSlim(info);
                content[flag] = {
                    description: info.description,
                    environments: info.environments && Object.assign({}, ...Object.keys(info.environments).map(env => ({
                        [env]: {
                            value: info.environments[env].value
                        }
                    }))),
                    tags: info.tags,
                    updatedAt: isoTimestamp,
                    updatedBy: user
                };
            }
            else if (args.length === 1 || (args.length === 2 && typeof args[0] === "string")) {
                const env = (args.length === 2) ? args.shift() : this.config.defaultEnv;
                const value = args[0];
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
            }
            else {
                throw new Error("invalid arguments");
            }
            yield this.putFlagFile(filename, content);
        });
    }
    delete(flag, arg1) {
        return __awaiter(this, void 0, void 0, function* () {
            const timestamp = Date.now();
            const isoTimestamp = (new Date(timestamp)).toISOString();
            const filename = this.generateUpdateFilename(timestamp);
            const content = {};
            if (typeof arg1 === "string") {
                content[flag] = {
                    deletedAt: isoTimestamp,
                    deletedBy: arg1
                };
            }
            else if (arg1 && arg1.permanent) {
                content[flag] = null;
            }
            else {
                throw new Error("invalid arguments");
            }
            yield this.putFlagFile(filename, content);
        });
    }
    restore(flag) {
        return __awaiter(this, void 0, void 0, function* () {
            const filename = this.generateUpdateFilename();
            const content = {
                deletedAt: null,
                deletedBy: null
            };
            yield this.putFlagFile(filename, content);
        });
    }
    refresh() {
        return __awaiter(this, void 0, void 0, function* () {
            this.cache.bundle = yield this.getFlagsFromS3();
        });
    }
    optimize() {
        return __awaiter(this, void 0, void 0, function* () {
            const optimizeDelay = this.config.optimizeDelay;
            const filenames = yield this.listFlagFiles();
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
                        this.cache.files[filename] = yield this.getFlagFile(filename);
                    }
                }
                const oldBundle = this.cache.files[latestBundleFilename] || {};
                const sortedUpdatesToBundle = sortedUpdateFilenames.map(filename => this.cache.files[filename]);
                const newBundle = this.mergeFlagFiles(oldBundle, sortedUpdatesToBundle);
                const lastUpdateFilenameToBundle = sortedUpdateFilenamesToBundle[sortedUpdateFilenamesToBundle.length - 1];
                const newBundleTimestamp = this.getTimestampFromFilename(lastUpdateFilenameToBundle);
                const newBundleFilename = `bundle.${newBundleTimestamp}.json`;
                yield this.putFlagFile(newBundleFilename, newBundle);
                this.cache.files[newBundleFilename] = newBundle;
                sortedBundleFilenames.push(newBundleFilename);
            }
            // clean up bundle files; keep no more than one bundle file that existed longer than optimizeDelay
            for (let i = 0; i < sortedBundleFilenames.length - 1; i++) {
                const nextFilename = sortedBundleFilenames[i + 1];
                const nextFileTimestamp = this.getTimestampFromFilename(nextFilename) || 0;
                // TODO: use a safe creation time check
                if (Date.now() - nextFileTimestamp >= optimizeDelay * 2) {
                    yield this.deleteFlagFile(sortedBundleFilenames[i]);
                    sortedBundleFilenames.splice(i--, 1);
                }
            }
            // clean up update files (created at or earlier than timestamp of the first bundle file)
            const firstBundleFileTimestamp = this.getTimestampFromFilename(sortedBundleFilenames[0]) || 0;
            for (let i = 0; i < sortedUpdateFilenames.length; i++) {
                const filename = sortedUpdateFilenames[i];
                const timestamp = this.getTimestampFromFilename(filename) || 0;
                if (timestamp <= firstBundleFileTimestamp) {
                    yield this.deleteFlagFile(filename);
                    sortedUpdateFilenames.splice(i--, 1);
                }
            }
        });
    }
    validateFlagInfoSlim(info) {
        if (typeof info.description === "undefined") {
            throw new Error("`description` is required");
        }
        if (typeof info.description !== "string") {
            throw new Error("`description` should be a string");
        }
        if (typeof info.environments !== "object") {
            throw new Error("`environments` should be an object");
        }
        else {
            for (const env of Object.keys(info.environments)) {
                if (typeof info.environments[env] !== "object") {
                    throw new Error(`\`environments["${env}"]\` should be an object`);
                }
            }
            const valueTypes = Array.from(new Set(Object.keys(info.environments).map(env => typeof info.environments[env].value)));
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
    validatePartialFlagInfoSlim(info) {
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
            const valueTypes = Array.from(new Set(Object.keys(info.environments).map(env => typeof info.environments[env].value)));
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
    getFlagsFromS3() {
        return __awaiter(this, void 0, void 0, function* () {
            const filenames = yield this.listFlagFiles();
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
                    this.cache.files[filename] = yield this.getFlagFile(filename);
                }
            }
            const bundle = this.cache.files[latestBundleFilename] || {};
            const updates = sortedUpdateFilenames.map(filename => this.cache.files[filename]);
            return this.mergeFlagFiles(bundle, updates);
        });
    }
    listFlagFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucket, prefix } = this.splitS3Location(this.config.location);
            let filenames = [];
            for (let continuationToken;;) {
                const params = { Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken };
                const response = yield this.s3.listObjectsV2(params).promise();
                if (response.Contents) {
                    filenames = filenames.concat(response.Contents
                        .map(obj => (obj.Key || "").slice(prefix.length))
                        .filter(filename => /^(bundle|update)\.\d+(\.[a-z\d]+)?\.json$/.test(filename)));
                }
                if (response.NextContinuationToken) {
                    continuationToken = response.NextContinuationToken;
                }
                else {
                    break;
                }
            }
            return filenames;
        });
    }
    getFlagFile(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucket, prefix } = this.splitS3Location(this.config.location);
            const response = yield this.s3.getObject({ Bucket: bucket, Key: prefix + filename }).promise();
            if (!response.Body) {
                throw new Error(`unable to get content of s3 file "${filename}"`);
            }
            return JSON.parse(response.Body.toString());
        });
    }
    putFlagFile(filename, content) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucket, prefix } = this.splitS3Location(this.config.location);
            const body = JSON.stringify(content, null, 2);
            yield this.s3.putObject({ Bucket: bucket, Key: prefix + filename, Body: body }).promise();
        });
    }
    deleteFlagFile(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucket, prefix } = this.splitS3Location(this.config.location);
            yield this.s3.deleteObject({ Bucket: bucket, Key: prefix + filename }).promise();
        });
    }
    splitS3Location(location) {
        const matches = /^(.*?)(?:\/(.*))?$/.exec(location) || [];
        const bucket = matches[1] || "";
        const prefix = (matches[2] || "").replace(/^(.+?)\/*$/, "$1/");
        return { bucket, prefix };
    }
    getTimestampFromFilename(filename) {
        const matches = /^(?:bundle|update)\.(\d+)(?:\.[a-z\d]+)?\.json$/.exec(filename);
        if (matches) {
            return parseInt(matches[1]);
        }
        else {
            return null;
        }
    }
    generateUpdateFilename(timestamp) {
        if (!timestamp) {
            timestamp = Date.now();
        }
        return `update.${timestamp}.${Math.floor(2821109907456 * Math.random()).toString(36)}.json`;
    }
    mergeFlagFiles(bundle, updates) {
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
                                    value: info.environments[env].value,
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
    clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}
exports.S3Flags = S3Flags;
//# sourceMappingURL=s3flags.js.map