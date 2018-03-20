# s3flags

Flag system for Node.js backed by AWS S3

(TODO: Update README)

## Example

```typescript
import { S3Flags } from "s3flags";

async function example() {
  const flags = new S3Flags({
    location: "my-bucket/flags",
    defaultEnv: "dev",
    refreshInterval: 300000,
    optimizeInterval: 300000,
    optimizeDelay: 300000
  });

  await flags.init();

  if (flags.on("enableFeatureA")) {
    console.log(flags.get("maxNumberOfX", { default: 10 }));
  }
}
```

## How it works

This library stores two kinds of files on AWS S3. One is called the *bundle files*. A *bundle file* stores all flags
for all environments at a certain time. The other is called the *update files*. Whenever a update (or delete) is made,
a *update file* is created.

Periodically, *update files* are bundled and a new *bundle file* is created. After waiting for some time, the old
*bundle file* and *update files* get deleted. We call this the *optimize process*.

At some point your files on AWS S3 might look like this.

> bundle.1519469473054.json  
> bundle.1519470224755.json  
> update.1519469652006.4r6ud75o.json  
> update.1519470224755.lziok5td.json  
> update.1519470450911.r83tlq0i.json  

Each file contains a timestamp in the filename. For *update files*, the timestamp stands for when the update was made.
For *bundle files*, however, the timestamp is not when the bundle was created but is when the last update was made.
With this setup, it is easy for us to know which file(s) are currently effective and which are obsolete.

For *update files*, the filename also contains a random string because multiple users might make changes at exactly the
same time.

When this library initializes, it requests for the list of files on AWS S3. It then loads the contents of the latest
*bundle file* and all *update files* that have timestamp larger than that of the bundle. Loaded files and merge result
of the bundle and updates are cached.

For the example above, the contents of `bundle.1519470224755.json` and `update.1519470450911.r83tlq0i.json` are loaded.
Other files are ignored.

Later on, when the client tries to get flags, it loads from the cached result.

Periodically, the cached result is refreshed. The *refresh process* is similar to the *initialization process*, except
that cached files are not loaded again from AWS S3.

Why so complicated? Because this library is designed to be used by multi-server systems and tries to minimize the
posibilities of getting problems due to the uncertain delay of the Eventual Consistency model of AWS S3.

## API

### class S3Flags

#### constructor(config: Config)

Instantiate `S3Flags` with configurations. See [interface Config](#interface-config) for more details.

```typescript
const flags = new S3Flags({
  location: "my-bucket/flags",
  defaultEnv: "dev",
  refreshInterval: 300000,
  optimizeInterval: 300000,
  optimizeDelay: 300000
});
```

#### init(): Promise\<void>

Initialize by loading flag files from S3 and setup *refresh* and *optimize* timers. This must be called and waited
before you can start getting flags.

```typescript
await flags.init();
```

#### get\<T>(flag: string, options: { default: T, env?: string }): T

Get value of a flag, for the default or given environment. If the flag does not exist or the default / given
environment of this flag is not configured, the default value provided in the `options` is returned.

```typescript
const enableFeatureA = flags.get("enableFeatureA", { default: false });
const maxNumberOfX = flags.get("maxNumberOfX", { default: 10 });
```

#### get\<T>(flag: string, options: { info: true, env?: string }): FlagInfo\<T> | null

Get full information of a flag, for the default or given environment. See
[interface FlagInfo<T>](#interface-flaginfot) for more details on what is returned. If the flag does not exist or the
default / given environment of this flag is not configured, `null` is returned.

```typescript
const flagInfo = flags.get("enableFeatureA", { info: true });
if (flagInfo) {
  console.log(flagInfo.updatedBy);
}
```

### on(name: string, options?: { env?: string }): boolean

An alias for getting the value of a boolean flag with default of `false`.

Note: If the flag exists but is not of type `boolean`, `false` is returned no matter what the actual value is.

```typescript
if (flags.on("enableFeatureA")) {
  // feature A code here
}
```

#### all(): FlagCollection

Export all flags for all environments with full information. See [interface FlagCollection](#interface-flagcollection)
for more details.

```typescript
app.get("/flags", function (req, res) {
  res.send(flags.all());
});
```

#### update(flag: string, value: string | number | boolean, user: string): Promise\<void>

Update value of the given flag for the default environment. If the flag does not exist or it is not configured for the
default environment, it gets created / configured.

Note: This does not take effect until next refresh.

```typescript
await flags.update("enableFeatureA", true, "someone");
```

#### update(flag: string, env: string, value: string | number | boolean, user: string): Promise\<void>

Update value of the given flag for the given environment. If the flag does not exist or it is not configured for the
given environment, it gets created / configured.

Note: This does not take effect until next refresh.

```typescript
await flags.update("enableFeatureA", "prod", false, "someone");
```

#### update(flag: string, values: { [env: string]: string | number | boolean }, user: string): Promise\<void>

Update values of the given flag for multiple environments. If the flag does not exist or it is not configured for some
of the given environments, it gets created / configured.

Note: This does not take effect until next refresh.

```typescript
await flags.update("enableFeatureA", { dev: true, prod: false }, "someone");
```

#### update(flags: { [flag: string]: { [env: string]: string | number | boolean } }, user: string): Promise\<void>

Update values of multiple flags for multiple environments. For non-existent flags or non-configured environments, they
get created / configured.

Note: This does not take effect until next refresh.

```typescript
await flags.update({ "enableFeatureA": { dev: true, prod: false }, "maxNumberOfX": { dev: 5, prod: 10 } }, "someone");
```

#### delete(flag: string): Promise\<void>

Delete a flag for all environments.

Note: This does not take effect until next refresh.

Note: Unlike the `update` method, this does not track when and by whom the request is made because the whole section
for the flag gets deleted. If you do need tracking, you have to log yourself.

```typescript
await flags.delete("enableFeatureA");
```

#### refresh(): Promise\<void>

Manually trigger the *refresh* process.

```typescript
await flags.refresh();
```

#### optimize(): Promise\<void>

Manually trigger the *optimize* process.

```typescript
await flags.optimize();
```

#### clearTimers(): void

Clear *refresh* and *optimize* timers. Call this if you want to destroy the `S3Flags` instance.

```typescript
await flags.clearTimers();
```

### interface Config

#### location: string

AWS S3 location to get / put flags. This starts with the S3 bucket name and can be optionally followed by a S3 prefix.
The prefix is assumed to be ended with a slash because this library requires a directory.

Example: `"my-bucket/flags"`

#### defaultEnv: string

The default environment for getting / updating flags. The recommended setting is to match the application environment.

Example: `process.env.NODE_ENV === "production" ? "prod" : "dev"`

#### refreshInterval: number

Time interval in milliseconds to get updates from AWS S3. Set it to `-1` if you never want it to refresh.

Example: `300000`

#### optimizeInterval: number

Time interval in milliseconds to bundle *update files* and delete obsolete files on AWS S3. Set it to `-1` if you never
want it to optimize.

Example: `300000`

#### optimizeDelay: number

Delay in milliseconds before a new *update file* can be bundled and before obsolete files (when a new *bundle file* is
created) can be deleted. This is necessary to reduce the posibilities of getting problems due to the uncertain delay of
the Eventual Consistency model of AWS S3.

Example: `300000`

#### awsAccessKeyId?: string

*Access Key ID* of AWS credential for accessing the specified AWS S3 bucket. This is optional as long as AWS SDK has
access to your bucket.

Example: `"AKIAI5OMOV5OWFRETGCQ"`

#### awsSecretAccessKey?: string

*Secret Access Key* of AWS credential for accessing the specified AWS S3 bucket. This is optional as long as AWS SDK
has access to your bucket.

Example: `"7sUWIo1f+Th/C4BJpU+Y2VAG3l5H/da3wrmwiKMM"`

### interface FlagInfo\<T>

#### value: T

Value of this flag.

Example: `true`

#### createdAt: string

Date and time string in ISO format representing when this flag was created.

Note: This field is always included in the *update files* even for existing flags. But it is ignored when the update
gets merged into an existing bundle.

Example: `"2018-02-22T02:28:05.448Z"`

#### createdBy: string

User who created this flag.

Note: This field is always included in the *update files* even for existing flags. But it is ignored when the update
gets merged into an existing bundle.

Example: `"someone"`

#### updatedAt: string

Date and time string in ISO format representing when this flag was last updated.

Example: `"2018-02-22T02:28:05.448Z"`

#### updatedBy: string

User who made the last update to this flag.

Example: `"someone"`

### interface FlagCollection

#### [flag: string]: { [env: string]: FlagInfo<string | number | boolean> }

Example:

```JSON
{
  "enableFeatureA": {
    "dev": {
      "value": true,
      "createdAt": "2018-02-22T02:28:05.448Z",
      "updatedAt": "2018-02-24T03:20:19.470Z",
      "createdBy": "user1",
      "updatedBy": "user2"
    },
    "prod": {
      "value": false,
      "createdAt": "2018-02-22T02:28:05.448Z",
      "updatedAt": "2018-02-22T02:28:05.448Z",
      "createdBy": "user1",
      "updatedBy": "user1"
    }
  },
  "maxNumberOfX": {
    "dev": {
      "value": 5,
      "createdAt": "2018-02-22T02:31:27.419Z",
      "updatedAt": "2018-02-22T02:31:27.419Z",
      "createdBy": "user3",
      "updatedBy": "user3"
    },
    "prod": {
      "value": 10,
      "createdAt": "2018-02-22T02:31:27.419Z",
      "updatedAt": "2018-02-22T02:31:27.419Z",
      "createdBy": "user3",
      "updatedBy": "user3"
    }
  }
}
```
