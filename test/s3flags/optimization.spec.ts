import { expect } from "chai";
import { S3Flags } from "../../src/s3flags";

describe("optimization", function () {
  let s3flags: S3Flags;

  context("if `optimizeInterval` is set to a positive number", function () {
    const OPTIMIZE_INTERVAL = 300000;
    const OPTIMIZE_DELAY = OPTIMIZE_INTERVAL * 3 - 1;

    let bundle1Timstamp: number;
    let bundle1Filename: string;

    beforeEach(async function () {
      bundle1Timstamp = Date.now();
      bundle1Filename = `bundle.${bundle1Timstamp}.json`;

      this.s3mock("test-bucket", {
        [`flags/${bundle1Filename}`]: `
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

      s3flags = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1,
        optimizeInterval: OPTIMIZE_INTERVAL,
        optimizeDelay: OPTIMIZE_DELAY
      });

      await s3flags.init();
    });

    afterEach(function () {
      s3flags.destroy();
    });

    it("should try to bundle update files and clean up outdated files once every `optimizeInterval` ms",
        async function () {

      let filenames: string[];

      // op: ---o--o--o--o--o--o--o--o--o--o--o--o
      // b1: c-----------------s--d
      // u1: ---c--------s--------d
      // u2: ---------------c--------s--------d
      // b2: ------------c--------s-----------d
      // b3: ------------------------c--------s---

      await this.tick(OPTIMIZE_INTERVAL);

      // no file changes since there's no update yet
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(1);
      expect(filenames[0]).to.equal(bundle1Filename);

      // someone created the first update file on s3
      const update1Timestamp = Date.now();
      const update1IsoTimestamp = (new Date(update1Timestamp)).toISOString();
      const update1Filename = `update.${update1Timestamp}.e7o0s0qn.json`;
      await this.putFlagFile("test-bucket", "flags", update1Filename, {
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
          "createdAt": update1IsoTimestamp,
          "createdBy": "test_user_4"
        }
      });

      // tick some `optimizeInterval`s and stop just before the first update file reaches `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL * Math.ceil((OPTIMIZE_DELAY - OPTIMIZE_INTERVAL) / OPTIMIZE_INTERVAL));

      // no new bundle file should have been created yet
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(2);
      expect(filenames[0]).to.equal(bundle1Filename);
      expect(filenames[1]).to.equal(update1Filename);

      // tick another `optimizeInterval`; this time the first update file has reached `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL);

      // the second bundle file should have been created while the first bundle and update file are still there
      const bundle2Filename = `bundle.${update1Timestamp}.json`;
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(3);
      expect(filenames[0]).to.equal(bundle1Filename);
      expect(filenames[1]).to.equal(bundle2Filename);
      expect(filenames[2]).to.equal(update1Filename);
      expect(await this.getFlagFile("test-bucket", "flags", bundle2Filename)).to.eql({
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
              "updatedAt": update1IsoTimestamp,
              "updatedBy": "test_user_4"
            },
            "prod": {
              "value": 222,
              "updatedAt": update1IsoTimestamp,
              "updatedBy": "test_user_4"
            }
          },
          "tags": [],
          "createdAt": update1IsoTimestamp,
          "createdBy": "test_user_4",
          "updatedAt": update1IsoTimestamp,
          "updatedBy": "test_user_4",
          "deletedAt": null,
          "deletedBy": null
        }
      });

      await this.tick(OPTIMIZE_INTERVAL);

      // someone created the second update file on s3
      const update2Timestamp = Date.now();
      const update2IsoTimestamp = (new Date(update2Timestamp)).toISOString();
      const update2Filename = `update.${update2Timestamp}.4zkvtpj5.json`;
      await this.putFlagFile("test-bucket", "flags", update2Filename, {
        "flag2": {
          "environments": {
            "dev": {
              "value": true
            }
          },
          "updatedAt": update2IsoTimestamp,
          "updatedBy": "test_user_5"
        }
      });

      // tick some `optimizeInterval`s and stop just before the second bundle file reaches `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL * Math.max(0,
        Math.ceil((update1Timestamp + OPTIMIZE_DELAY * 2 - OPTIMIZE_INTERVAL - Date.now()) / OPTIMIZE_INTERVAL)));

      // the first bundle file and the first update file should still be there
      // because we keep at least one bundle file that has existed longer than `optimizeDelay`
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(4);
      expect(filenames[0]).to.equal(bundle1Filename);
      expect(filenames[1]).to.equal(bundle2Filename);
      expect(filenames[2]).to.equal(update1Filename);
      expect(filenames[3]).to.equal(update2Filename);

      // tick another `optimizeInterval`; this time the second bundle file has reached `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL);

      // the first bundle file and the first update file should have been cleaned up
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(2);
      expect(filenames[0]).to.equal(bundle2Filename);
      expect(filenames[1]).to.equal(update2Filename);

      // tick some `optimizeInterval`s and stop just after the second update file reaches `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL * Math.max(0,
        Math.ceil((update2Timestamp + OPTIMIZE_DELAY - Date.now()) / OPTIMIZE_INTERVAL)));

      // the third bundle file should have been created
      const bundle3Filename = `bundle.${update2Timestamp}.json`;
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(3);
      expect(filenames[0]).to.equal(bundle2Filename);
      expect(filenames[1]).to.equal(bundle3Filename);
      expect(filenames[2]).to.equal(update2Filename);
      expect(await this.getFlagFile("test-bucket", "flags", bundle3Filename)).to.eql({
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
              "value": true,
              "updatedAt": update2IsoTimestamp,
              "updatedBy": "test_user_5"
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
          "updatedAt": update2IsoTimestamp,
          "updatedBy": "test_user_5",
          "deletedAt": null,
          "deletedBy": null
        },
        "flag3": {
          "description": "test flag 3",
          "environments": {
            "dev": {
              "value": 111,
              "updatedAt": update1IsoTimestamp,
              "updatedBy": "test_user_4"
            },
            "prod": {
              "value": 222,
              "updatedAt": update1IsoTimestamp,
              "updatedBy": "test_user_4"
            }
          },
          "tags": [],
          "createdAt": update1IsoTimestamp,
          "createdBy": "test_user_4",
          "updatedAt": update1IsoTimestamp,
          "updatedBy": "test_user_4",
          "deletedAt": null,
          "deletedBy": null
        }
      });

      // tick some `optimizeInterval`s and stop just before the third bundle file reaches `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL * Math.max(0,
        Math.ceil((update2Timestamp + OPTIMIZE_DELAY * 2 - OPTIMIZE_INTERVAL - Date.now()) / OPTIMIZE_INTERVAL)));

      // the second bundle file and update file should still be there
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(3);
      expect(filenames[0]).to.equal(bundle2Filename);
      expect(filenames[1]).to.equal(bundle3Filename);
      expect(filenames[2]).to.equal(update2Filename);

      // tick another `optimizeInterval`; this time the third bundle file has reached `optimizeDelay`
      await this.tick(OPTIMIZE_INTERVAL);

      // the second bundle file and update file should have been cleaned up
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(1);
      expect(filenames[0]).to.equal(bundle3Filename);

      // tick for a long time
      await this.tick(OPTIMIZE_INTERVAL * 10);

      // should have no file changes
      filenames = (await this.listFlagFiles("test-bucket", "flags")).sort();
      expect(filenames).to.be.an("array").that.has.lengthOf(1);
      expect(filenames[0]).to.equal(bundle3Filename);
    });
  });

  context("if `optimizeInterval` is set to zero or a negative number", function () {
    let bundle1Timstamp: number;
    let update1Timestamp: number;
    let update2Timestamp: number;

    beforeEach(async function () {
      bundle1Timstamp = Date.now();
      update1Timestamp = bundle1Timstamp + 30000;
      update2Timestamp = update1Timestamp + 50000;

      await this.tick(update2Timestamp - bundle1Timstamp);

      this.s3mock("test-bucket", {
        [`flags/bundle.${bundle1Timstamp}.json`]: `
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
        [`flags/update.${update1Timestamp}.e7o0s0qn.json`]: `
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
              "createdAt": "${(new Date(update1Timestamp)).toISOString()}",
              "createdBy": "test_user_4"
            }
          }
        `,
        [`flags/update.${update2Timestamp}.4zkvtpj5.json`]: `
          {
            "flag2": {
              "environments": {
                "dev": {
                  "value": true
                }
              },
              "updatedAt": "${(new Date(update2Timestamp)).toISOString()}",
              "updatedBy": "test_user_5"
            }
          }
        `
      });

      s3flags = new S3Flags({
        location: "test-bucket/flags",
        defaultEnv: "dev",
        refreshInterval: -1,
        optimizeInterval: -1, // well, only -1 is tested here
        optimizeDelay: -1
      });

      await s3flags.init();
    });

    it("should never optimize", async function () {
      await this.tick(365 * 24 * 3600 * 1000);

      const filenames = await this.listFlagFiles("test-bucket", "flags");

      expect(filenames).to.be.an("array").that.has.lengthOf(3);
      expect(filenames[0]).to.equal(`bundle.${bundle1Timstamp}.json`);
      expect(filenames[1]).to.equal(`update.${update1Timestamp}.e7o0s0qn.json`);
      expect(filenames[2]).to.equal(`update.${update2Timestamp}.4zkvtpj5.json`);
    });
  });
});
