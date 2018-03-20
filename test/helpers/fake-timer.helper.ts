beforeEach(function () {
  const timer = this.sinon.useFakeTimers(Date.now());
  this.tick = async function (ms: number): Promise<void> {
    timer.tick(ms);
    await new Promise((resolve, reject) => process.nextTick(resolve));
  };
});
