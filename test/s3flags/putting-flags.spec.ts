import { expect } from "chai";
import { S3Flags } from "../../src/s3flags";

describe("putting flags", function () {
  let s3flags: S3Flags;

  beforeEach(async function () {
    this.s3mock("test-bucket", {
      "flags/bundle.1519470734246.json": `
        {
          "flag1": {
            "description": "test flag 1 - updated",
            "environments": {
              "dev": {
                "value": true,
                "updatedAt": "2018-02-24T10:47:05.956Z",
                "updatedBy": "test_user"
              },
              "prod": {
                "value": true,
                "updatedAt": "2018-02-24T10:54:12.006Z",
                "updatedBy": "test_user_3"
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T10:47:05.956Z",
            "createdBy": "test_user",
            "updatedAt": "2018-02-24T10:54:12.006Z",
            "updatedBy": "test_user_3",
            "deletedAt": null,
            "deletedBy": null
          },
          "flag2": {
            "description": "test flag 2",
            "environments": {
              "dev": {
                "value": false,
                "updatedAt": "2018-02-24T10:54:12.006Z",
                "updatedBy": "test_user_3"
              },
              "prod": {
                "value": false,
                "updatedAt": "2018-02-24T10:54:12.006Z",
                "updatedBy": "test_user_3"
              }
            },
            "tags": ["a", "b"],
            "createdAt": "2018-02-24T10:51:13.054Z",
            "createdBy": "test_user_2",
            "updatedAt": "2018-02-24T10:54:12.006Z",
            "updatedBy": "test_user_3",
            "deletedAt": null,
            "deletedBy": null
          },
          "flag3": {
            "description": "test flag 3",
            "environments": {
              "dev": {
                "value": 111,
                "updatedAt": "2018-02-24T11:03:44.755Z",
                "updatedBy": "test_user_4"
              },
              "prod": {
                "value": 222,
                "updatedAt": "2018-02-24T11:03:44.755Z",
                "updatedBy": "test_user_4"
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T11:03:44.755Z",
            "createdBy": "test_user_4",
            "updatedAt": "2018-02-24T11:03:44.755Z",
            "updatedBy": "test_user_4",
            "deletedAt": null,
            "deletedBy": null
          },
          "flag5": {
            "description": "test flag 5",
            "environments": {
              "dev": {
                "value": true,
                "updatedAt": "2018-02-24T11:08:35.332Z",
                "updatedBy": "test_user_5"
              },
              "prod": {
                "value": true,
                "updatedAt": "2018-02-24T11:08:35.332Z",
                "updatedBy": "test_user_5"
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T11:08:35.332Z",
            "createdBy": "test_user_5",
            "updatedAt": "2018-02-24T11:08:35.332Z",
            "updatedBy": "test_user_5",
            "deletedAt": "2018-02-24T11:12:14.246Z",
            "deletedBy": "test_user_6"
          }
        }
      `
    });

    s3flags = new S3Flags({
      location: "test-bucket/flags",
      defaultEnv: "dev",
      refreshInterval: -1,
      optimizeInterval: -1,
      optimizeDelay: -1
    });

    await s3flags.init();
  });

  it("should put a update file on S3 whenever a flag is being created, updated or deleted", async function () {
    let filenames: string[];
    let timestamp: number | null;
    let content: any;

    await s3flags.create("flag6", {
      description: "test flag 6",
      environments: {
        dev: { value: true },
        prod: { value: false }
      }
    }, "test_user_7");
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(2);
    timestamp = this.getTimestampFromFlagFilename(filenames[1]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[1]);
    expect(content).to.eql({
      "flag6": {
        "description": "test flag 6",
        "environments": {
          "dev": { "value": true },
          "prod": { "value": false }
        },
        "tags": [],
        "createdAt": (new Date()).toISOString(),
        "createdBy": "test_user_7"
      }
    });

    await this.tick(Math.floor(Math.random() * 1000) + 1);

    await s3flags.update("flag1", false, "test_user_8");
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(3);
    timestamp = this.getTimestampFromFlagFilename(filenames[2]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[2]);
    expect(content).to.eql({
      "flag1": {
        "environments": {
          "dev": { "value": false }
        },
        "updatedAt": (new Date()).toISOString(),
        "updatedBy": "test_user_8"
      }
    });

    await this.tick(Math.floor(Math.random() * 1000) + 1);

    await s3flags.update("flag1", "prod", false, "test_user_9");
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(4);
    timestamp = this.getTimestampFromFlagFilename(filenames[3]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[3]);
    expect(content).to.eql({
      "flag1": {
        "environments": {
          "prod": { "value": false }
        },
        "updatedAt": (new Date()).toISOString(),
        "updatedBy": "test_user_9"
      }
    });

    await s3flags.update("flag2", {
      description: "test flag 2 - updated",
      environments: {
        dev: { value: true },
        prod: { value: true }
      }
    }, "test_user_10");
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(5);
    timestamp = this.getTimestampFromFlagFilename(filenames[4]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[4]);
    expect(content).to.eql({
      "flag2": {
        "description": "test flag 2 - updated",
        "environments": {
          "dev": { "value": true },
          "prod": { "value": true }
        },
        "updatedAt": (new Date()).toISOString(),
        "updatedBy": "test_user_10"
      }
    });

    await this.tick(Math.floor(Math.random() * 1000) + 1);

    await s3flags.delete("flag3", "test_user_11");
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(6);
    timestamp = this.getTimestampFromFlagFilename(filenames[5]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[5]);
    expect(content).to.eql({
      "flag3": {
        "deletedAt": (new Date()).toISOString(),
        "deletedBy": "test_user_11"
      }
    });

    await this.tick(Math.floor(Math.random() * 1000) + 1);

    await s3flags.delete("flag5", { permanent: true });
    filenames = await this.listFlagFiles("test-bucket", "flags");
    expect(filenames).to.be.an("array").that.has.lengthOf(7);
    timestamp = this.getTimestampFromFlagFilename(filenames[6]);
    expect(timestamp).to.equal(Date.now());
    content = await this.getFlagFile("test-bucket", "flags", filenames[6]);
    expect(content).to.eql({ "flag5": null });
  });
});
