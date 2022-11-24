import type { SinonStub } from "sinon";

const callFakeOnce = <T extends SinonStub>(
  stubFn: T,
  fake: (...args: unknown[]) => unknown,
  finalFake: (...args: unknown[]) => unknown
): T => {
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
