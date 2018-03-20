import { S3 } from "aws-sdk";
import * as sinon from "sinon";

beforeEach(function () {
  const s3 = new S3();

  this.listFlagFiles = async function (bucket: string, dir: string): Promise<string[]> {
    const prefix = ((dir || "") + "/").replace(/\/{2,}/, "/").replace(/^\//, "");

    const response = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix }).promise();

    if (response && response.Contents) {
      return response.Contents
        .map(obj => (obj.Key || "").slice(prefix.length))
        .filter(filename => /^(bundle|update)\.\d+(\.[a-z\d]+)?\.json$/.test(filename));
    } else {
      return [];
    }
  };

  this.getFlagFile = async function (bucket: string, dir: string, filename: string): Promise<any> {
    const prefix = ((dir || "") + "/").replace(/\/{2,}/, "/").replace(/^\//, "");
    const response = await s3.getObject({ Bucket: bucket, Key: prefix + filename }).promise();
    return JSON.parse((response.Body as Buffer).toString());
  };

  this.putFlagFile = async function (bucket: string, dir: string, filename: string, content: any): Promise<void> {
    const prefix = ((dir || "") + "/").replace(/\/{2,}/, "/").replace(/^\//, "");
    const body = JSON.stringify(content, null, 2);
    await s3.putObject({ Bucket: bucket, Key: prefix + filename, Body: body }).promise();
  };

  this.getTimestampFromFlagFilename = function (filename: string): number | null {
    const matches = /^(?:bundle|update)\.(\d+)(?:\.[a-z\d]+)?\.json$/.exec(filename);
    if (matches) {
      return parseInt(matches[1]);
    } else {
      return null;
    }
  };
});
