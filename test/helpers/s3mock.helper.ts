import { S3 } from "aws-sdk";
import * as sinon from "sinon";

beforeEach(function () {
  const buckets: { [bucket: string]: { [objectKey: string]: string | Buffer } } = {};

  this.s3mock = function (bucket: string, objects: { [key: string]: string | Buffer }): void {
    buckets[bucket] = objects;

    const s3proto = (new S3()).constructor.prototype;

    if (!s3proto.listObjectsV2.hasOwnProperty("isSinonProxy")) {
      this.sinon.stub(s3proto, "listObjectsV2").callsFake((params: any) => ({
        promise: () => Promise.resolve({
          Contents: Object.keys(buckets[params.Bucket]).map(key => ({ Key: key }))
        })
      }));
    }

    if (!s3proto.getObject.hasOwnProperty("isSinonProxy")) {
      this.sinon.stub(s3proto, "getObject").callsFake((params: any) => ({
        promise: () => Promise.resolve({
          Body: Buffer.from(buckets[params.Bucket][params.Key] as any)
        })
      }));
    }

    if (!s3proto.putObject.hasOwnProperty("isSinonProxy")) {
      this.sinon.stub(s3proto, "putObject").callsFake((params: any) => ({
        promise: () => {
          buckets[params.Bucket][params.Key] = params.Body;
          return Promise.resolve();
        }
      }));
    }

    if (!s3proto.deleteObject.hasOwnProperty("isSinonProxy")) {
      this.sinon.stub(s3proto, "deleteObject").callsFake((params: any) => ({
        promise: () => {
          delete buckets[params.Bucket][params.Key];
          return Promise.resolve();
        }
      }));
    }
  };
});
