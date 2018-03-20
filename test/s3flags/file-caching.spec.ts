import { S3 } from "aws-sdk";
import { expect } from "chai";
import { SinonStub } from "sinon";
import { S3Flags } from "../../src/s3flags";

describe("file caching", function () {
  const REFRESH_INTERVAL = 300000;

  let s3flags: S3Flags;
  let s3: S3;

  beforeEach(async function () {
    this.s3mock("test-bucket", {
      "flags/bundle.1519469473054.json": `
        {
          "flag1": {
            "description": "test flag 1",
            "environments": {
              "dev": {
                "value": true,
                "updatedAt": "2018-02-24T10:47:05.956Z",
                "updatedBy": "test_user"
              },
              "prod": {
                "value": false,
                "updatedAt": "2018-02-24T10:47:05.956Z",
                "updatedBy": "test_user"
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T10:47:05.956Z",
            "createdBy": "test_user",
            "updatedAt": "2018-02-24T10:47:05.956Z",
            "updatedBy": "test_user",
            "deletedAt": null,
            "deletedBy": null
          },
          "flag2": {
            "description": "test flag 2",
            "environments": {
              "dev": {
                "value": true,
                "updatedAt": "2018-02-24T10:51:13.054Z",
                "updatedBy": "test_user_2"
              },
              "prod": {
                "value": true,
                "updatedAt": "2018-02-24T10:51:13.054Z",
                "updatedBy": "test_user_2"
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T10:51:13.054Z",
            "createdBy": "test_user_2",
            "updatedAt": "2018-02-24T10:51:13.054Z",
            "updatedBy": "test_user_2",
            "deletedAt": null,
            "deletedBy": null
          }
        }
      `,
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
      `,
      "flags/update.1519469225956.54cvbq21.json": `
        {
          "flag1": {
            "description": "test flag 1",
            "environments": {
              "dev": {
                "value": true
              },
              "prod": {
                "value": false
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T10:47:05.956Z",
            "createdBy": "test_user"
          }
        }
      `,
      "flags/update.1519469473054.lw3uz2lm.json": `
        {
          "flag2": {
            "description": "test flag 2",
            "environments": {
              "dev": {
                "value": true
              },
              "prod": {
                "value": true
              }
            },
            "tags": [],
            "createdAt": "2018-02-24T10:51:13.054Z",
            "createdBy": "test_user_2"
          }
        }
      `,
      "flags/update.1519469652006.4r6ud75o.json": `
        {
          "flag1": {
            "description": "test flag 1 - updated",
            "environments": {
              "prod": {
                "value": true
              }
            },
            "updatedAt": "2018-02-24T10:54:12.006Z",
            "updatedBy": "test_user_3"
          },
          "flag2": {
            "environments": {
              "dev": {
                "value": false
              },
              "prod": {
                "value": false
              }
            },
            "tags": ["a", "b"],
            "updatedAt": "2018-02-24T10:54:12.006Z",
            "updatedBy": "test_user_3"
          }
        }
      `,
      "flags/update.1519470224755.lziok5td.json": `
        {
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
        }
      `
    });

    s3flags = new S3Flags({
      location: "test-bucket/flags",
      defaultEnv: "dev",
      refreshInterval: REFRESH_INTERVAL,
      optimizeInterval: -1,
      optimizeDelay: -1
    });

    await s3flags.init();

    s3 = new S3();
  });

  afterEach(function () {
    s3flags.destroy();
  });

  context("for the initial load", function () {
    it("should load the contents of the latest bundle file and all update files newer than that bundle from s3",
        function () {
      // `init` has already been called on `beforeEach`
      expect(s3.getObject).to.have.been.calledTwice;

      const args = (s3.getObject as SinonStub).args;
      expect(args[0][0]).to.eql({ Bucket: "test-bucket", Key: "flags/bundle.1519469652006.json" });
      expect(args[1][0]).to.eql({ Bucket: "test-bucket", Key: "flags/update.1519470224755.lziok5td.json" });
    });
  });

  context("when there's no updates", function () {
    it("should never load any files again from s3", async function () {
      expect(s3.getObject).to.have.been.calledTwice;
      await this.tick(REFRESH_INTERVAL);
      expect(s3.getObject).to.have.been.calledTwice; // no new calls
      await this.tick(REFRESH_INTERVAL * 10);
      expect(s3.getObject).to.have.been.calledTwice; // no new calls
    });
  });

  context("when there's new update(s)", function () {
    it("only loads the new file(s) from s3", async function () {
      const getObject = s3.getObject as SinonStub;

      expect(getObject).to.have.been.calledTwice;

      await this.putFlagFile("test-bucket", "flags", "update.1519470515332.tn7o1uk6.json", {});
      expect(getObject).to.have.been.calledTwice; // no new calls yet
      await this.tick(REFRESH_INTERVAL);
      expect(getObject).to.have.been.calledThrice; // one new call
      expect(getObject.getCall(2)).to.have.been
        .calledWithExactly({ Bucket: "test-bucket", Key: "flags/update.1519470515332.tn7o1uk6.json" });

      await this.putFlagFile("test-bucket", "flags", "update.1519470734246.nnlyfy00.json", {});
      await this.putFlagFile("test-bucket", "flags", "update.1519470941723.oqoanbfc.json", {});
      expect(getObject).to.have.calledThrice; // no new call yet
      await this.tick(REFRESH_INTERVAL);
      expect(getObject).to.have.callCount(5); // two new calls
      expect(getObject.getCall(3)).to.have.been
        .calledWithExactly({ Bucket: "test-bucket", Key: "flags/update.1519470734246.nnlyfy00.json" });
      expect(getObject.getCall(4)).to.have.been
        .calledWithExactly({ Bucket: "test-bucket", Key: "flags/update.1519470941723.oqoanbfc.json" });
    });
  });
});
