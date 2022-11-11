import type { Provider } from '@ethersproject/abstract-provider';
import * as addressUtils from '@ethersproject/address';
import * as solidityUtils from '@ethersproject/solidity';
import type { SmartWalletFactory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/factory/SmartWalletFactory';
import { SmartWalletFactory__factory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/factories/contracts/factory';
import { expect, use } from 'chai';
import crypto from 'crypto';
import { BigNumber, providers, Signer } from 'ethers';
import { HDNode } from 'ethers/lib/utils';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import {
  discoverAccountsFromMnemonic,
  DiscoveryConfig
} from '../src/smartWalletDiscovery';
import { callFakeOnce } from './utils';

const sandbox = createSandbox();
use(sinonChai);

const FAKE_BYTECODE = `0x${crypto.pseudoRandomBytes(32).toString('hex')}`;
console.log('FAKE_BYTECODE', FAKE_BYTECODE);
const FAKE_BALANCE = BigNumber.from('1000000000000000000');
const FAKE_SHA3_RESULT = `0x${crypto.pseudoRandomBytes(32).toString('hex')}`;
console.log('FAKE_SHA3_RESULT', FAKE_SHA3_RESULT);


describe('smartWalletDiscovery', function () {
  afterEach(function () {
    sandbox.restore();
  });
  describe('discoverAccountsFromMnemonic', function () {
    let connectSWFFactoryStub: sinon.SinonStub<
      [string, Signer | Provider],
      SmartWalletFactory
    >;
    let fromMnemonicStub: sinon.SinonStub;
    let fakeSmartWalletFactory: SinonStubbedInstance<
      Partial<SmartWalletFactory>
    >;

    beforeEach(function () {
      fakeSmartWalletFactory = {
        getCreationBytecode: sandbox.stub(),
      };
      sandbox.stub(solidityUtils, 'keccak256').callsFake(() => FAKE_SHA3_RESULT);

      sandbox.stub(providers, 'getDefaultProvider').callsFake(
        () =>
          ({
            getBalance: callFakeOnce(
              sandbox.stub(),
              () => FAKE_BALANCE,
              () => BigNumber.from(0)
            ),
            getTransactionCount: sandbox.stub().returns(0)
          } as unknown as providers.BaseProvider)
      );
      sandbox.stub(addressUtils, 'getAddress').callsFake(() => {
        const randomAddress = `0x${FAKE_SHA3_RESULT.slice(26)}`;

        return randomAddress;
      });

      (
        fakeSmartWalletFactory as SinonStubbedInstance<SmartWalletFactory>
      ).getCreationBytecode.resolves(FAKE_BYTECODE);
      connectSWFFactoryStub = sandbox
        .stub(SmartWalletFactory__factory, 'connect')
        .returns(fakeSmartWalletFactory as unknown as SmartWalletFactory);
      fromMnemonicStub = sandbox.stub(HDNode, 'fromMnemonic').returns({
        derivePath: sandbox.stub().returns({
          address: '0x123456789,',
        }),
      } as unknown as HDNode);
    });

    it('should retreive hd wallet using mnemonic and password', async function () {
      const expectedMnemonic = 'foo bar';
      const expectedPassword = 'baz';
      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1
        } as DiscoveryConfig,
        expectedMnemonic,
        expectedPassword
      );

      expect(fromMnemonicStub).to.have.been.calledWith(
        expectedMnemonic,
        expectedPassword
      );
    });

    it('should connect to the smart wallet factory contract', async function () {
      const expectedFactoryAddr = '0x123';
      await discoverAccountsFromMnemonic(
        {
          factory: expectedFactoryAddr,
          sWalletGap: 1,
          eoaGap: 1
        } as DiscoveryConfig,
        '',
        ''
      );

      expect(connectSWFFactoryStub).to.have.been.calledWith(
        expectedFactoryAddr,
        sandbox.match.any
      );
    });

    it('should call the sw factory to get creation bytecode', async function () {
      const expectedBytecode = FAKE_BYTECODE;
      (
        fakeSmartWalletFactory as SinonStubbedInstance<SmartWalletFactory>
      ).getCreationBytecode.resolves(expectedBytecode);

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1
        } as DiscoveryConfig,
        '',
        ''
      );

      expect(fakeSmartWalletFactory.getCreationBytecode).to.have.been.called;
    });
  });
  // });
});
