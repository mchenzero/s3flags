import { expect } from "chai";
import { S3Flags } from "../../src/s3flags";

describe("getting flags", function () {
  let s3flags: S3Flags;

  beforeEach(async function () {
    s3flags = new S3Flags({
      location: "test-bucket/flags",
      defaultEnv: "dev",
      refreshInterval: -1,
      optimizeInterval: -1,
      optimizeDelay: -1
    });
  });

  context("when no flag files exist on s3", function () {
    beforeEach(async function () {
      this.s3mock("test-bucket", {});
      await s3flags.init();
    });

    it("should get an empty set", function () {
      expect(s3flags.all()).to.be.an("object").that.is.empty;
    });
  });

  context("when there're only update files", function () {
    beforeEach(async function () {
      this.s3mock("test-bucket", {
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
        `,
        "flags/update.1519470515332.tn7o1uk6.json": `
          {
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
          }
        `,
        "flags/update.1519470734246.nnlyfy00.json": `
          {
            "flag4": null,
            "flag5": {
              "deletedAt": "2018-02-24T11:12:14.246Z",
              "deletedBy": "test_user_6"
            }
          }
        `
      });
      await s3flags.init();
    });

    it("should get flags by merging all the update files", function () {
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

  context("when there's only one bundle file", function () {
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
        `
      });
      await s3flags.init();
    });

    it("should get flags in the bundle file", function () {
      expect(s3flags.all()).to.eql({
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
      });
    });
  });

  context("when there're one bundle file and some update files newer than the bundle", function () {
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
        `,
        "flags/update.1519470515332.tn7o1uk6.json": `
          {
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
          }
        `,
        "flags/update.1519470734246.nnlyfy00.json": `
          {
            "flag4": null,
            "flag5": {
              "deletedAt": "2018-02-24T11:12:14.246Z",
              "deletedBy": "test_user_6"
            }
          }
        `
      });
      await s3flags.init();
    });

    it("should get flags by merging the bundle file and all the update files", function () {
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

  context("when there're one bundle file and some update files newer or older than the bundle", function () {
    beforeEach(async function () {
      // outdated update files are modified (not consistent with the latest bundle) so that we can easily assert that
      // they are ignored
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
        `,
        "flags/update.1519470515332.tn7o1uk6.json": `
          {
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
          }
        `,
        "flags/update.1519470734246.nnlyfy00.json": `
          {
            "flag4": null,
            "flag5": {
              "deletedAt": "2018-02-24T11:12:14.246Z",
              "deletedBy": "test_user_6"
            }
          }
        `
      });
      await s3flags.init();
    });

    it("should get flags by merging the bundle file and update files newer than the bundle", function () {
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

  context("when there're multiple bundle files and update files", function () {
    beforeEach(async function () {
      // outdated bundle & update files are modified (not consistent with the latest bundle) so that we can easily
      // assert that they are ignored
      this.s3mock("test-bucket", {
        "flags/bundle.1519469473054.json": `
          {
            "flag1": {
              "description": "",
              "environments": {
                "dev": {
                  "value": null,
                  "updatedAt": "1970-01-01T00:00:00.000Z",
                  "updatedBy": "ghost"
                },
                "prod": {
                  "value": null,
                  "updatedAt": "1970-01-01T00:00:00.000Z",
                  "updatedBy": "ghost"
                }
              },
              "tags": [],
              "createdAt": "1970-01-01T00:00:00.000Z",
              "createdBy": "ghost",
              "updatedAt": "1970-01-01T00:00:00.000Z",
              "updatedBy": "ghost",
              "deletedAt": null,
              "deletedBy": null
            },
            "flag2": {
              "description": "",
              "environments": {
                "dev": {
                  "value": null,
                  "updatedAt": "1970-01-01T00:00:00.000Z",
                  "updatedBy": "ghost"
                },
                "prod": {
                  "value": null,
                  "updatedAt": "1970-01-01T00:00:00.000Z",
                  "updatedBy": "ghost"
                }
              },
              "tags": [],
              "createdAt": "1970-01-01T00:00:00.000Z",
              "createdBy": "ghost",
              "updatedAt": "1970-01-01T00:00:00.000Z",
              "updatedBy": "ghost",
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
        `,
        "flags/update.1519470515332.tn7o1uk6.json": `
          {
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
          }
        `,
        "flags/update.1519470734246.nnlyfy00.json": `
          {
            "flag4": null,
            "flag5": {
              "deletedAt": "2018-02-24T11:12:14.246Z",
              "deletedBy": "test_user_6"
            }
          }
        `
      });
      await s3flags.init();
    });

    it("should get flags by merging the latest bundle file and update files newer than the latest bundle",
        function () {
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
