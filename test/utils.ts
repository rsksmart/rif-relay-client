import type { SinonStub } from "sinon";

const callFakeOnce = (
  stubFn: SinonStub,
  fake: (...args: unknown[]) => unknown,
  finalFake: (...args: unknown[]) => unknown
): SinonStub => {
  stubFn.callsFake((...args: unknown[]) => {
    const response = fake(...args);
    stubFn.callsFake(finalFake);

    return response;
  });

  return stubFn;
};

export {
  callFakeOnce
};
