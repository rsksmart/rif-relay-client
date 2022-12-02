import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import KnownRelaysManager, {
  RelayFilter,
  RelayFailureInfo,
} from '../src/KnownRelaysManager';
import {
  ContractInteractor,
  EnvelopingConfig,
} from '@rsksmart/rif-relay-common';
import type { LogLevelNumbers } from 'loglevel';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

describe('KnownRelaysManager', function () {
  let contractInteractor: SinonStubbedInstance<ContractInteractor>;
  const envelopingConfig: EnvelopingConfig = {
    chainId: 33,
    clientId: '',
    deployVerifierAddress: '',
    forwarderAddress: '',
    gasPriceFactorPercent: 0.02,
    relayVerifierAddress: '',
    relayHubAddress: '',
    smartWalletFactoryAddress: '',
    sliceSize: 0,
    relayTimeoutGrace: 0,
    relayLookupWindowParts: 0,
    relayLookupWindowBlocks: 0,
    maxRelayNonceGap: 0,
    minGasPrice: 0,
    methodSuffix: '',
    preferredRelays: [],
    onlyPreferredRelays: true,
    jsonStringifyRequest: true,
    logLevel: 0 as LogLevelNumbers,
  };

  describe('constructor', function () {
    beforeEach(function () {
      contractInteractor = sandbox.createStubInstance(ContractInteractor);
    });

    after(function () {
      sandbox.restore();
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should store contract interactor and config', function () {
      const knownRelaysManager = new KnownRelaysManager(
        contractInteractor,
        envelopingConfig
      );

      expect(knownRelaysManager);
    });

    it('should store contract interactor and config, relay filter', function () {
      const relayFilter: RelayFilter = () => {
        return true;
      };

      const knownRelaysManager = new KnownRelaysManager(
        contractInteractor,
        envelopingConfig,
        relayFilter
      );

      expect(knownRelaysManager);
    });

    it('should store contract interactor and config, relay filter and score calculator', function () {
      const relayFilter: RelayFilter = () => {
        return true;
      };

      const scoreCalc = (failures: RelayFailureInfo[]) => {
        return Math.pow(0.9, failures.length);
      };

      const knownRelaysManager = new KnownRelaysManager(
        contractInteractor,
        envelopingConfig,
        relayFilter,
        scoreCalc
      );

      expect(knownRelaysManager);
    });
  });
});
