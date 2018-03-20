import { S3 } from "aws-sdk";
import { expect } from "chai";
import { S3Flags } from "../../src/s3flags";

describe("refreshing flags", function () {
  const REFRESH_INTERVAL = 300000;

  let s3flags: S3Flags;
  let s3: S3;

  beforeEach(function () {
    this.s3mock("test-bucket", {
      "flags/bundle.1519469652006.json": `
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
          }
        }
      `
    });
    s3 = new S3();
  });

  afterEach(function () {
    s3flags.destroy();
  });

  context("if `refreshInterval` is set to a positive number", function () {
    beforeEach(async function () {
      s3flags = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: REFRESH_INTERVAL,
        optimizeInterval: -1,
        optimizeDelay: -1
      });
      await s3flags.init();
    });

    it("should try to get updates once every `refreshInterval` ms", async function () {
      // wait until Date.now() % REFRESH_INTERVAL === 0
      await this.tick(REFRESH_INTERVAL - Date.now() % REFRESH_INTERVAL);

      await this.putFlagFile("test-bucket", "flags", "update.1519470224755.lziok5td.json", {
        "flag3": {
          "description": "test flag 3",
          "environments": {
            "dev": {
              "value": 111
            },
            "prod": {
              "value": 222
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:03:44.755Z",
          "createdBy": "test_user_4"
        }
      });
      expect(s3flags.get("flag3", { info: true })).to.be.null; // not updated yet
      await this.tick(REFRESH_INTERVAL - 1);
      expect(s3flags.get("flag3", { info: true })).to.be.null; // still not updated
      await this.tick(1);
      expect(s3flags.get("flag3", { info: true })).not.to.be.null; // updated after REFRESH_INTERVAL ms

      await this.putFlagFile("test-bucket", "flags", "update.1519470515332.tn7o1uk6.json", {
        "flag4": {
          "description": "test flag 4",
          "environments": {
            "dev": {
              "value": true
            },
            "prod": {
              "value": true
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:08:35.332Z",
          "createdBy": "test_user_5"
        },
        "flag5": {
          "description": "test flag 5",
          "environments": {
            "dev": {
              "value": true
            },
            "prod": {
              "value": true
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:08:35.332Z",
          "createdBy": "test_user_5"
        }
      });
      await this.putFlagFile("test-bucket", "flags", "update.1519470734246.nnlyfy00.json", {
        "flag4": null,
        "flag5": {
          "deletedAt": "2018-02-24T11:12:14.246Z",
          "deletedBy": "test_user_6"
        }
      });
      expect(s3flags.get("flag5", { info: true })).to.be.null; // not updated yet
      await this.tick(REFRESH_INTERVAL - 1);
      expect(s3flags.get("flag5", { info: true })).to.be.null; // still not updated
      await this.tick(1);
      expect(s3flags.get("flag5", { info: true })).not.to.be.null; // updated after REFRESH_INTERVAL ms
    });
  });

  context("if `refreshInterval` is set to zero or a negative number", function () {
    beforeEach(async function () {
      s3flags = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1, // well, only -1 is tested here
        optimizeInterval: -1,
        optimizeDelay: -1
      });
      await s3flags.init();
    });

    it("should never try to get updates", async function () {
      await this.putFlagFile("test-bucket", "flags", "update.1519470224755.lziok5td.json", {
        "flag3": {
          "description": "test flag 3",
          "environments": {
            "dev": {
              "value": 111
            },
            "prod": {
              "value": 222
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:03:44.755Z",
          "createdBy": "test_user_4"
        }
      });
      expect(s3flags.get("flag3", { info: true })).to.be.null; // not updated
      await this.tick(REFRESH_INTERVAL - 1);
      expect(s3flags.get("flag3", { info: true })).to.be.null; // not updated
      await this.tick(1);
      expect(s3flags.get("flag3", { info: true })).to.be.null; // not updated

      await this.putFlagFile("test-bucket", "flags", "update.1519470515332.tn7o1uk6.json", {
        "flag4": {
          "description": "test flag 4",
          "environments": {
            "dev": {
              "value": true
            },
            "prod": {
              "value": true
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:08:35.332Z",
          "createdBy": "test_user_5"
        },
        "flag5": {
          "description": "test flag 5",
          "environments": {
            "dev": {
              "value": true
            },
            "prod": {
              "value": true
            }
          },
          "tags": [],
          "createdAt": "2018-02-24T11:08:35.332Z",
          "createdBy": "test_user_5"
        }
      });
      await this.putFlagFile("test-bucket", "flags", "update.1519470734246.nnlyfy00.json", {
        "flag4": null,
        "flag5": {
          "deletedAt": "2018-02-24T11:12:14.246Z",
          "deletedBy": "test_user_6"
        }
      });
      expect(s3flags.get("flag5", { info: true })).to.be.null; // not updated
      await this.tick(REFRESH_INTERVAL - 1);
      expect(s3flags.get("flag5", { info: true })).to.be.null; // not updated
      await this.tick(1);
      expect(s3flags.get("flag5", { info: true })).to.be.null; // not updated

      await this.tick(REFRESH_INTERVAL * 10);
      expect(s3flags.get("flag3", { info: true })).to.be.null; // never updated
      expect(s3flags.get("flag5", { info: true })).to.be.null; // never updated
    });
  });
});
