declare namespace Mocha {
  interface ContextExtension {
    sinon: sinon.SinonSandbox;
    tick(ms: number): Promise<void>;
    s3mock(bucket: string, objects: { [key: string]: string | Buffer }): void;
    listFlagFiles(bucket: string, dir: string): Promise<string[]>;
    getFlagFile(bucket: string, dir: string, filename: string): Promise<any>;
    putFlagFile(bucket: string, dir: string, filename: string, content: any): Promise<void>;
    getTimestampFromFlagFilename(filename: string): number | null;
  }

  interface ISuiteCallbackContext extends ContextExtension {}
  interface IHookCallbackContext extends ContextExtension {}
  interface ITestCallbackContext extends ContextExtension {}
}
