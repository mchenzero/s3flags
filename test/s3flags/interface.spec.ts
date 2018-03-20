import { S3 } from "aws-sdk";
import { expect } from "chai";
import { SinonStub } from "sinon";
import { S3Flags } from "../../src/s3flags";

describe("class S3Flags", function () {
  let s3flags: S3Flags;

  const REFRESH_INTERVAL = 300000;
  const OPTIMIZE_INTERVAL = 300000;

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
      refreshInterval: REFRESH_INTERVAL,
      optimizeInterval: OPTIMIZE_INTERVAL,
      optimizeDelay: 300000
    });

    await s3flags.init();
  });

  afterEach(function () {
    s3flags.destroy();
  });

  describe("#constructor", function () {
    it("should require passing in a configuration object", function () {
      expect(() => new (S3Flags as any)()).to.throw("a configuration object must be provided");
    });

    it("should require the s3 location to be set", function () {
      const config1 = {};
      const config2 = { location: "test-bucket/flags" };
      expect(() => new (S3Flags as any)(config1)).to.throw("s3 location must be provided");
      expect(() => new (S3Flags as any)(config2)).not.to.throw("s3 location must be provided");
    });

    it("should require the default environment to be set", function () {
      const config1 = { location: "test-bucket/flags" };
      const config2 = { location: "test-bucket/flags", defaultEnv: "dev" };
      expect(() => new (S3Flags as any)(config1)).to.throw("default environment must be provided");
      expect(() => new (S3Flags as any)(config2)).not.to.throw("default environment must be provided");
    });

    it("should require optimize delay to be greater than or equal to optimize interval if optimize interval is set and "
        + "greater than 0", function () {
      const config1 = { location: "test-bucket/flags", defaultEnv: "dev" };
      expect(() => new (S3Flags as any)(config1)).not.to.throw();

      const config2 = Object.assign({}, config1, { optimizeInterval: -1 });
      expect(() => new (S3Flags as any)(config2)).not.to.throw();

      const config3 = Object.assign({}, config1, { optimizeInterval: 0 });
      expect(() => new (S3Flags as any)(config3)).not.to.throw();

      const config4 = Object.assign({}, config1, { optimizeInterval: 300000 });
      expect(() => new (S3Flags as any)(config4))
        .to.throw("`optimizeDelay` should be greater than or equal to `optimizeInterval`");

      const config5 = Object.assign({}, config1, { optimizeInterval: 300000, optimizeDelay: -1 });
      expect(() => new (S3Flags as any)(config5))
        .to.throw("`optimizeDelay` should be greater than or equal to `optimizeInterval`");

      const config6 = Object.assign({}, config1, { optimizeInterval: 300000, optimizeDelay: 0 });
      expect(() => new (S3Flags as any)(config6))
        .to.throw("`optimizeDelay` should be greater than or equal to `optimizeInterval`");

      const config7 = Object.assign({}, config1, { optimizeInterval: 300000, optimizeDelay: 299999 });
      expect(() => new (S3Flags as any)(config7))
        .to.throw("`optimizeDelay` should be greater than or equal to `optimizeInterval`");

      const config8 = Object.assign({}, config1, { optimizeInterval: 300000, optimizeDelay: 300000 });
      expect(() => new (S3Flags as any)(config8)).not.to.throw();

      const config9 = Object.assign({}, config1, { optimizeInterval: 300000, optimizeDelay: 500000 });
      expect(() => new (S3Flags as any)(config9)).not.to.throw();
    });
  });

  describe("#init", function () {
    let s3: S3;

    beforeEach(async function () {
      // reset the outter `beforeEach`
      s3flags.destroy();
      s3 = new S3();
      (s3.getObject as SinonStub).resetHistory();
      s3flags = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: REFRESH_INTERVAL,
        optimizeInterval: OPTIMIZE_INTERVAL,
        optimizeDelay: 300000
      });
    });

    it("should load flags from s3", async function () {
      expect(s3.getObject).not.to.have.been.called;
      await s3flags.init();
      expect(s3.getObject).to.have.been.called;
    });

    it("should setup refresh and optimize timers", async function () {
      const refreshSpy = this.sinon.spy(s3flags, "refresh");
      await this.tick(REFRESH_INTERVAL * 10);
      expect(refreshSpy).not.to.have.been.called;
      await s3flags.init();
      expect(refreshSpy).to.have.been.calledOnce;
      await this.tick(REFRESH_INTERVAL);
      expect(refreshSpy).to.have.been.calledTwice;
      await this.tick(REFRESH_INTERVAL * 10);
      expect(refreshSpy).to.have.callCount(12);

      s3flags.destroy();

      const optimizeSpy = this.sinon.spy(s3flags, "optimize");
      await this.tick(OPTIMIZE_INTERVAL * 10);
      expect(optimizeSpy).not.to.have.been.called;
      await s3flags.init();
      expect(optimizeSpy).not.to.have.been.called;
      await this.tick(OPTIMIZE_INTERVAL);
      expect(optimizeSpy).to.have.been.calledOnce;
      await this.tick(OPTIMIZE_INTERVAL * 10);
      expect(optimizeSpy).to.have.callCount(11);
    });
  });

  describe("#destroy", function () {
    it("should stop the refresh and optimize timers", async function () {
      s3flags.destroy();

      await s3flags.update("flag1", false, "test_user_7");
      expect(s3flags.on("flag1")).to.be.true;
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.on("flag1")).to.be.true;
      await this.tick(REFRESH_INTERVAL * 10);
      expect(s3flags.on("flag1")).to.be.true;

      await this.putFlagFile("test-bucket", "flags", "update.1519470941723.oqoanbfc.json", {
        "flag5": null
      });
      const filenames = await this.listFlagFiles("test-bucket", "flags");
      await this.tick(OPTIMIZE_INTERVAL);
      expect(await this.listFlagFiles("test-bucket", "flags")).to.eql(filenames);
      await this.tick(OPTIMIZE_INTERVAL * 10);
      expect(await this.listFlagFiles("test-bucket", "flags")).to.eql(filenames);
    });
  });

  describe("#get", function () {
    context("if `info` option is not set", function () {
      it("should return the value of the flag for the given / default environment if the flag exists", function () {
        expect(s3flags.get("flag1", { default: false })).to.be.true;
        expect(s3flags.get("flag1", { default: false, env: "dev" })).to.be.true;
        expect(s3flags.get("flag1", { default: false, env: "prod" })).to.be.true;
        expect(s3flags.get("flag2", { default: true })).to.be.false;
        expect(s3flags.get("flag2", { default: true, env: "dev" })).to.be.false;
        expect(s3flags.get("flag2", { default: true, env: "prod" })).to.be.false;
        expect(s3flags.get("flag3", { default: 0 })).to.equal(111);
        expect(s3flags.get("flag3", { default: 0, env: "dev" })).to.equal(111);
        expect(s3flags.get("flag3", { default: 0, env: "prod" })).to.equal(222);
      });

      it("should return the given default value if the flag does not exist or had been softly deleted", function () {
        expect(s3flags.get("non-existent-flag1", { default: false })).to.be.false;
        expect(s3flags.get("non-existent-flag1", { default: true, env: "dev" })).to.be.true;
        expect(s3flags.get("non-existent-flag1", { default: false, env: "prod" })).to.be.false;
        expect(s3flags.get("non-existent-flag2", { default: 0 })).to.equal(0);
        expect(s3flags.get("non-existent-flag2", { default: 1, env: "dev" })).to.equal(1);
        expect(s3flags.get("non-existent-flag2", { default: 2, env: "prod" })).to.equal(2);
        expect(s3flags.get("non-existent-flag3", { default: "" })).to.equal("");
        expect(s3flags.get("non-existent-flag3", { default: "aaa", env: "dev" })).to.equal("aaa");
        expect(s3flags.get("non-existent-flag3", { default: "bbb", env: "prod" })).to.equal("bbb");
        expect(s3flags.get("flag5", { default: false })).to.be.false;
        expect(s3flags.get("flag5", { default: false, env: "dev" })).to.be.false;
        expect(s3flags.get("flag5", { default: true, env: "prod" })).to.be.true;
      });
    });

    context("if `info` option is set to true", function () {
      it("should return full information of the flag if it exists", function () {
        expect(s3flags.get("flag1", { info: true })).to.eql({
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
        });

        expect(s3flags.get("flag2", { info: true })).to.eql({
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
        });

        expect(s3flags.get("flag3", { info: true })).to.eql({
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
        });

        expect(s3flags.get("flag5", { info: true })).to.eql({
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
        });
      });

      it("should return null if the flag does not exist", function () {
        expect(s3flags.get("non-existent-flag1", { info: true })).to.be.null;
        expect(s3flags.get("non-existent-flag2", { info: true })).to.be.null;
        expect(s3flags.get("non-existent-flag3", { info: true })).to.be.null;
      });
    });

    it("should throw an error if the S3Flags instance has not been initialized", async function () {
      const s3flags2 = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1,
        optimizeInterval: -1,
        optimizeDelay: 300000
      });

      expect(() => s3flags2.get("flag1", { default: false }))
        .to.throw("cannot get flag(s) before initialization completes");

      const promise = s3flags2.init();

      expect(() => s3flags2.get("flag1", { default: false }))
        .to.throw("cannot get flag(s) before initialization completes");

      await promise;

      expect(() => s3flags2.get("flag1", { default: false })).not.to.throw();
    });
  });

  describe("#on", function () {
    context("for existing boolean flags", function () {
      it("should return the flag value", function () {
        expect(s3flags.on("flag1")).to.be.true;
        expect(s3flags.on("flag1", { env: "dev" })).to.be.true;
        expect(s3flags.on("flag1", { env: "prod" })).to.be.true;
        expect(s3flags.on("flag2")).to.be.false;
        expect(s3flags.on("flag2", { env: "dev" })).to.be.false;
        expect(s3flags.on("flag2", { env: "prod" })).to.be.false;
      });
    });

    context("for non-existent, non-boolean or softly deleted flags", function () {
      it("should return false", function () {
        expect(s3flags.on("flag2")).to.be.false;
        expect(s3flags.on("flag2", { env: "dev" })).to.be.false;
        expect(s3flags.on("flag2", { env: "prod" })).to.be.false;
        expect(s3flags.on("non-existent-flag")).to.be.false;
        expect(s3flags.on("non-existent-flag", { env: "dev" })).to.be.false;
        expect(s3flags.on("non-existent-flag", { env: "prod" })).to.be.false;
        expect(s3flags.on("flag5")).to.be.false;
        expect(s3flags.on("flag5", { env: "dev" })).to.be.false;
        expect(s3flags.on("flag5", { env: "prod" })).to.be.false;
      });
    });

    it("should throw an error if the S3Flags instance has not been initialized", async function () {
      const s3flags2 = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1,
        optimizeInterval: -1,
        optimizeDelay: 300000
      });

      expect(() => s3flags2.on("flag1")).to.throw("cannot get flag(s) before initialization completes");

      const promise = s3flags2.init();

      expect(() => s3flags2.on("flag1")).to.throw("cannot get flag(s) before initialization completes");

      await promise;

      expect(() => s3flags2.on("flag1")).not.to.throw();
    });
  });

  describe("#all", function () {
    it("should return full information of all flags", function () {
      expect(s3flags.all()).to.eql({
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
      });
    });

    it("should return a copy instead of the internal reference of the flags", function () {
      const result1 = s3flags.all();
      const result2 = s3flags.all();

      expect(result1).to.eql(result2);
      expect(result1).not.to.equal(result2);

      result1.flag1.environments.dev.value = false;
      result1.flag3.environments.prod.value = 22222;

      expect(result1).not.to.eql(result2);

      expect(s3flags.on("flag1")).to.be.true;
      expect(s3flags.get("flag3", { default: 0, env: "prod" })).to.be.equal(222);
    });

    it("should throw an error if the S3Flags instance has not been initialized", async function () {
      const s3flags2 = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1,
        optimizeInterval: -1,
        optimizeDelay: 300000
      });

      expect(() => s3flags2.all()).to.throw("cannot get flag(s) before initialization completes");

      const promise = s3flags2.init();

      expect(() => s3flags2.all()).to.throw("cannot get flag(s) before initialization completes");

      await promise;

      expect(() => s3flags2.all()).not.to.throw();
    });
  });

  describe("#create", function () {
    it("should create a flag on next refresh", async function () {
      let isoTimestamp = (new Date()).toISOString();

      await s3flags.create("flag6", {
        description: "test flag 6",
        environments: {
          dev: { value: true },
          prod: { value: false }
        }
      }, "test_user_7");

      expect(s3flags.get("flag6", { info: true })).to.be.null;

      await this.tick(REFRESH_INTERVAL);

      expect(s3flags.get("flag6", { info: true })).to.eql({
        description: "test flag 6",
        environments: {
          dev: {
            value: true,
            updatedAt: isoTimestamp,
            updatedBy: "test_user_7"
          },
          prod: {
            value: false,
            updatedAt: isoTimestamp,
            updatedBy: "test_user_7"
          }
        },
        tags: [],
        createdAt: isoTimestamp,
        createdBy: "test_user_7",
        updatedAt: isoTimestamp,
        updatedBy: "test_user_7",
        deletedAt: null,
        deletedBy: null
      });

      isoTimestamp = (new Date()).toISOString();

      await s3flags.create("flag7", {
        description: "test flag 7",
        environments: {
          dev: { value: "aaa" },
          prod: { value: "bbb" }
        },
        tags: ["a", "b"]
      }, "test_user_8");

      expect(s3flags.get("flag7", { info: true })).to.be.null;

      await this.tick(REFRESH_INTERVAL);

      expect(s3flags.get("flag7", { info: true })).to.eql({
        description: "test flag 7",
        environments: {
          dev: {
            value: "aaa",
            updatedAt: isoTimestamp,
            updatedBy: "test_user_8"
          },
          prod: {
            value: "bbb",
            updatedAt: isoTimestamp,
            updatedBy: "test_user_8"
          }
        },
        tags: ["a", "b"],
        createdAt: isoTimestamp,
        createdBy: "test_user_8",
        updatedAt: isoTimestamp,
        updatedBy: "test_user_8",
        deletedAt: null,
        deletedBy: null
      });
    });

    it("should be ignored if the flag already exists or had been softly deleted", async function () {
      await s3flags.create("flag1", {
        description: "recreate flag 1",
        environments: {
          dev: { value: false },
          prod: { value: false }
        }
      }, "test_user_7");

      await this.tick(REFRESH_INTERVAL);

      expect(s3flags.get("flag1", { info: true })).to.eql({
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
      });

      await s3flags.create("flag5", {
        description: "recreate flag 5",
        environments: {
          dev: { value: true },
          prod: { value: true }
        }
      }, "test_user_8");

      await this.tick(REFRESH_INTERVAL);

      expect(s3flags.get("flag5", { info: true })).to.eql({
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
      });
    });
  });

  describe("#update", function () {
    it("should update a flag on next refresh", async function () {
      let isoTimestamp: string;

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag1", false, "test_user_7");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag1", { info: true })).to.eql({
        "description": "test flag 1 - updated",
        "environments": {
          "dev": {
            "value": false,
            "updatedAt": isoTimestamp,
            "updatedBy": "test_user_7"
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
        "updatedAt": isoTimestamp,
        "updatedBy": "test_user_7",
        "deletedAt": null,
        "deletedBy": null
      });

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag2", "prod", true, "test_user_8");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag2", { info: true })).to.eql({
        "description": "test flag 2",
        "environments": {
          "dev": {
            "value": false,
            "updatedAt": "2018-02-24T10:54:12.006Z",
            "updatedBy": "test_user_3"
          },
          "prod": {
            "value": true,
            "updatedAt": isoTimestamp,
            "updatedBy": "test_user_8"
          }
        },
        "tags": ["a", "b"],
        "createdAt": "2018-02-24T10:51:13.054Z",
        "createdBy": "test_user_2",
        "updatedAt": isoTimestamp,
        "updatedBy": "test_user_8",
        "deletedAt": null,
        "deletedBy": null
      });

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag3", {
        description: "test flag 3 - updated",
        environments: {
          dev: { value: 11111 },
          prod: { value: 22222 }
        },
        tags: ["aaa"]
      }, "test_user_9");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag3", { info: true })).to.eql({
        "description": "test flag 3 - updated",
        "environments": {
          "dev": {
            "value": 11111,
            "updatedAt": isoTimestamp,
            "updatedBy": "test_user_9"
          },
          "prod": {
            "value": 22222,
            "updatedAt": isoTimestamp,
            "updatedBy": "test_user_9"
          }
        },
        "tags": ["aaa"],
        "createdAt": "2018-02-24T11:03:44.755Z",
        "createdBy": "test_user_4",
        "updatedAt": isoTimestamp,
        "updatedBy": "test_user_9",
        "deletedAt": null,
        "deletedBy": null
      });
    });

    it("should not update the timestamp and user if nothing changed", async function () {
      let isoTimestamp: string;

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag1", true, "test_user_7");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag1", { info: true })).to.eql({
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
      });

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag2", "prod", false, "test_user_8");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag2", { info: true })).to.eql({
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
      });

      isoTimestamp = (new Date()).toISOString();
      await s3flags.update("flag3", {
        description: "test flag 3",
        environments: {
          dev: { value: 111 },
          prod: { value: 222 }
        },
        tags: []
      }, "test_user_9");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.get("flag3", { info: true })).to.eql({
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
      });
    });

    it("should be ignored if the flag does not exist or had been softly deleted", async function () {
      await s3flags.update("non-existent-flag", true, "test_user_7");
      await s3flags.update("flag5", false, "test_user_7");
      await s3flags.update("flag5", "prod", false, "test_user_7");
      await s3flags.update("flag5", { description: "updated" }, "test_user_7");
      await this.tick(REFRESH_INTERVAL);
      expect(s3flags.all()).to.eql({
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
      });
    });
  });

  describe("#delete", function () {
    context("if `permanent` option is not set", function () {
      it("should softly delete a flag on next refresh", async function () {
        let isoTimestamp = (new Date()).toISOString();

        await s3flags.delete("flag1", "test_user_7");

        expect(s3flags.on("flag1", { env: "dev" })).to.be.true;
        expect(s3flags.on("flag1", { env: "prod" })).to.be.true;

        await this.tick(REFRESH_INTERVAL);

        expect(s3flags.on("flag1", { env: "dev" })).to.be.false;
        expect(s3flags.on("flag1", { env: "prod" })).to.be.false;

        expect(s3flags.get("flag1", { info: true })).to.eql({
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
          "deletedAt": isoTimestamp,
          "deletedBy": "test_user_7"
        });

        isoTimestamp = (new Date()).toISOString();

        await s3flags.delete("flag3", "test_user_8");

        expect(s3flags.get("flag3", { default: 0, env: "dev" })).to.equal(111);
        expect(s3flags.get("flag3", { default: 0, env: "prod" })).to.equal(222);

        await this.tick(REFRESH_INTERVAL);

        expect(s3flags.get("flag3", { default: 0, env: "dev" })).to.equal(0);
        expect(s3flags.get("flag3", { default: 0, env: "prod" })).to.equal(0);

        expect(s3flags.get("flag3", { info: true })).to.eql({
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
          "deletedAt": isoTimestamp,
          "deletedBy": "test_user_8"
        });
      });

      it("should be ignored if the flag does not exist or had already been softly deleted", async function () {
        await s3flags.delete("non-existent-flag", "test_user_7");
        await s3flags.delete("flag5", "test_user_8");

        await this.tick(REFRESH_INTERVAL);

        expect(s3flags.all()).to.eql({
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
        });
      });
    });

    context("if `permanent` option is set to true", function () {
      it("should permanently delete a flag on next refresh", async function () {
        await s3flags.delete("flag1", { permanent: true });
        expect(s3flags.get("flag1", { info: true })).not.to.be.null;
        await this.tick(REFRESH_INTERVAL);
        expect(s3flags.get("flag1", { info: true })).to.be.null;

        await s3flags.delete("flag3", { permanent: true });
        expect(s3flags.get("flag3", { info: true })).not.to.be.null;
        await this.tick(REFRESH_INTERVAL);
        expect(s3flags.get("flag3", { info: true })).to.be.null;
      });

      it("should be ignored if the flag does not exist", async function () {
        await s3flags.delete("non-existent-flag", "test_user_7");
        await this.tick(REFRESH_INTERVAL);
        expect(s3flags.all()).to.eql({
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
        });
      });
    });
  });

  describe("#refresh", function () {
    // see more tests in refreshing-flags.spec.ts
    it("should get updates from s3", async function () {
      await s3flags.update("flag1", false, "test_user_7");
      expect(s3flags.on("flag1")).to.be.true; // not updated yet
      await s3flags.refresh();
      expect(s3flags.on("flag1")).to.be.false; // updated yet

      await this.putFlagFile("test-bucket", "flags", "update.1519470941723.oqoanbfc.json", {
        "flag5": null
      });
      expect(s3flags.get("flag5", { info: true })).not.to.be.null; // not updated yet
      await s3flags.refresh();
      expect(s3flags.get("flag5", { info: true })).to.be.null; // updated
    });
  });

  describe("#optimize", function () {
    // see more tests in optimization.spec.ts
    it("should optimize flag files on s3", async function () {
      await this.putFlagFile("test-bucket", "flags", "update.1519470941723.oqoanbfc.json", {
        "flag5": null
      });

      await s3flags.optimize();

      const filenames = await this.listFlagFiles("test-bucket", "flags");
      expect(filenames).to.be.an("array").that.has.lengthOf(1);
      expect(filenames[0]).to.equal("bundle.1519470941723.json");
    });
  });
});
