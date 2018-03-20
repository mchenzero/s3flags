export type FlagValueTypes = string | number | boolean;

export interface FlagInfo<T extends FlagValueTypes = FlagValueTypes> {
  description: string;
  environments: {
    [env: string]: {
      value: T;
      updatedAt: string;
      updatedBy: string;
    };
  };
  tags: string[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface FlagInfoSlim<T extends FlagValueTypes = FlagValueTypes> {
  description: string;
  environments: {
    [env: string]: {
      value: T;
    };
  };
  tags?: string[];
}

export interface FlagCollection {
  [flag: string]: FlagInfo;
}

export interface S3FlagsConfig {
  readonly location: string;
  readonly environments: string[]; // TODO: add documentation
  readonly defaultEnv: string;
  readonly refreshInterval: number;
  readonly optimizeInterval: number;
  readonly optimizeDelay: number;
  readonly awsAccessKeyId?: string;
  readonly awsSecretAccessKey?: string;
}
