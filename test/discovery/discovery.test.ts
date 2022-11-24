import type { Provider } from '@ethersproject/abstract-provider';
import * as addressUtils from '@ethersproject/address';
import * as solidityUtils from '@ethersproject/solidity';
import { ERC20, ERC20__factory } from '@rsksmart/rif-relay-contracts';
import type { SmartWalletFactory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/contracts/factory/SmartWalletFactory';
import { SmartWalletFactory__factory } from '@rsksmart/rif-relay-contracts/dist/typechain-types/factories/contracts/factory';
import { expect, use } from 'chai';
import crypto from 'crypto';
import { BigNumber, constants, providers, Signer } from 'ethers';
import { HDNode } from 'ethers/lib/utils';
import sinon, { SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import {
  discoverAccountsFromExtendedPublicKeys,
  discoverAccountsFromMnemonic,
  DiscoveredAccount,
  DiscoveryConfig,
} from '../../src/discovery';
import * as discoveryUtils from '../../src/discovery/discovery.utils';
import { callFakeOnce } from '../utils';

use(sinonChai);

const FAKE_BYTECODE = `0x${crypto.pseudoRandomBytes(32).toString('hex')}`;
console.log('FAKE_BYTECODE', FAKE_BYTECODE);
const FAKE_BALANCE = constants.WeiPerEther.mul(7);
const FAKE_SHA3_RESULT = `0x${crypto.pseudoRandomBytes(32).toString('hex')}`;
console.log('FAKE_SHA3_RESULT', FAKE_SHA3_RESULT);
const FAKE_HD_NODE: HDNode = {
  address: '0x0000000000000000000000000000000000000001',
} as unknown as HDNode;

describe('smartWalletDiscovery', function () {
  afterEach(function () {
    sinon.restore();
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
    let getBalanceStub: sinon.SinonStub<
      Parameters<providers.BaseProvider['getBalance']>,
      ReturnType<providers.BaseProvider['getBalance']>
    >;
    let derivePathStub: sinon.SinonStub;
    let getAddressStub: sinon.SinonStub;
    let getCreationBytecodeStub: sinon.SinonStub<
      Parameters<SmartWalletFactory['getCreationBytecode']>,
      ReturnType<SmartWalletFactory['getCreationBytecode']>
    >;
    let providerStub: sinon.SinonStubbedInstance<providers.BaseProvider>;
    let sha3Stub: sinon.SinonStub;

    beforeEach(function () {
      getCreationBytecodeStub = sinon.stub();
      getCreationBytecodeStub.returns(Promise.resolve(FAKE_BYTECODE));
      fakeSmartWalletFactory = {
        getCreationBytecode: getCreationBytecodeStub,
      };
      sha3Stub = sinon
        .stub(solidityUtils, 'keccak256')
        .callsFake(() => FAKE_SHA3_RESULT);

      getBalanceStub = callFakeOnce(
        sinon.stub(),
        () => FAKE_BALANCE,
        () => BigNumber.from(0)
      );

      providerStub = sinon.createStubInstance(providers.BaseProvider);
      providerStub.getBalance = getBalanceStub;

      sinon
        .stub(providers, 'getDefaultProvider')
        .returns(providerStub as unknown as providers.BaseProvider);
      getAddressStub = sinon.stub(addressUtils, 'getAddress').callsFake(() => {
        const randomAddress = `0x${FAKE_SHA3_RESULT.slice(26)}`;

        return randomAddress;
      });
      connectSWFFactoryStub = sinon
        .stub(SmartWalletFactory__factory, 'connect')
        .returns(fakeSmartWalletFactory as unknown as SmartWalletFactory);

      derivePathStub = sinon
        .stub(HDNode.prototype, 'derivePath')
        .returns(FAKE_HD_NODE);
      fromMnemonicStub = sinon.stub(HDNode, 'fromMnemonic').returns({
        derivePath: derivePathStub,
      } as unknown as HDNode);
    });

    it('should retreive hd wallet using mnemonic and password', async function () {
      const expectedMnemonic = 'foo bar';
      const expectedPassword = 'baz';
      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
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
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(connectSWFFactoryStub).to.have.been.calledWith(
        expectedFactoryAddr,
        sinon.match.any
      );
    });

    it('should call the sw factory to get creation bytecode', async function () {
      const expectedBytecode = FAKE_BYTECODE;
      (
        fakeSmartWalletFactory as SinonStubbedInstance<SmartWalletFactory>
      ).getCreationBytecode.resolves(expectedBytecode);

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(fakeSmartWalletFactory.getCreationBytecode).to.have.been.called;
    });

    it('should call findHardenedNodeActivity ONCE if first hardened account DOES NOT have activity', async function () {
      sinon
        .stub(discoveryUtils, 'findHardenedNodeActivity')
        .returns(Promise.resolve([]));

      getBalanceStub.callsFake(() => {
        console.log('getBalanceStub called');

        return Promise.resolve(BigNumber.from(0));
      });

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(discoveryUtils.findHardenedNodeActivity).to.have.been.calledOnce;
    });

    it('should call findHardenedNodeActivity TWICE if first hardened account DOES have activity but second one DOES NOT', async function () {
      const findHardenedNodeActivityStub = sinon.stub(
        discoveryUtils,
        'findHardenedNodeActivity'
      );
      callFakeOnce(
        findHardenedNodeActivityStub,
        () => [FAKE_HD_NODE],
        () => []
      );

      callFakeOnce(
        getBalanceStub,
        () => FAKE_BALANCE,
        () => BigNumber.from(0)
      );

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(discoveryUtils.findHardenedNodeActivity).to.have.been.calledTwice;
    });

    it('should derive hd node from path', async function () {
      const expectedPath = "m/44'/137'/0'/0/0";

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(derivePathStub).to.have.been.calledWith(expectedPath);
    });

    it('should check that derived hd node has balance', async function () {
      const expectedEOAAddr = FAKE_HD_NODE.address;

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getBalanceStub).to.have.been.called;
      expect(getBalanceStub).to.have.been.calledWith(expectedEOAAddr);
    });

    it('should check that derived hd node has transaction if not balance', async function () {
      const expectedEOAAddr = FAKE_HD_NODE.address;
      const expectedTxCntSpy = sinon.spy();
      providerStub.getTransactionCount.callsFake(
        (address: string | Promise<string>) => {
          expectedTxCntSpy(address);

          return Promise.resolve(0);
        }
      );
      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(expectedTxCntSpy).to.have.been.called;
      expect(expectedTxCntSpy).to.have.been.calledWith(expectedEOAAddr);
    });

    it('should check that one of given tokens has derived hd node balance if hd node does not have balance or transactions', async function () {
      const erc20BalanceStub = sinon
        .stub()
        .returns(Promise.resolve(BigNumber.from(0)));
      const fakeERC20 = {
        balanceOf: erc20BalanceStub,
      } as unknown as ERC20;
      sinon.stub(ERC20__factory, 'connect').returns(fakeERC20);
      const expectedAccount = FAKE_HD_NODE.address;
      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));
      providerStub.getTransactionCount.returns(Promise.resolve(0));

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
          tokens: ['0x999'],
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(erc20BalanceStub).to.have.been.called;
      expect(erc20BalanceStub).to.have.been.calledWith(expectedAccount);
    });

    it('should return a list with active eoa if derived hd node has activity', async function () {
      callFakeOnce(
        sinon.stub(discoveryUtils, 'checkHasActivity'),
        () => true,
        () => false
      );
      const actualAccounts = await discoverAccountsFromMnemonic(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );
      const expectedAccount = FAKE_HD_NODE.address;

      expect(actualAccounts).to.have.lengthOf(1);
      expect(actualAccounts[0]?.eoaAccount).to.equal(expectedAccount);
    });

    it('should return a list with inactive eoa if the eoa has sw activity', async function () {
      sinon
        .stub(discoveryUtils, 'checkHasActivity')
        .returns(Promise.resolve(false));
      const expectedEOAAddr = FAKE_HD_NODE.address;
      const expectedSmartWalletAddresses = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ];
      callFakeOnce(
        getAddressStub,
        () => expectedSmartWalletAddresses[0],
        () => expectedSmartWalletAddresses[1]
      );

      let callCount = 0;
      getBalanceStub.callsFake((address: string | Promise<string>) => {
        if (
          expectedSmartWalletAddresses.includes(address as string) &&
          callCount < 2
        ) {
          callCount += 1;

          return Promise.resolve(BigNumber.from(1));
        }

        return Promise.resolve(BigNumber.from(0));
      });

      const actualAccounts = await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(actualAccounts).to.have.lengthOf(1);
      expect(actualAccounts[0]?.eoaAccount).to.equal(expectedEOAAddr);
      expect(actualAccounts[0]?.swAccounts[0]).to.equal(
        expectedSmartWalletAddresses[0]
      );
      expect(actualAccounts[0]?.swAccounts[1]).to.equal(
        expectedSmartWalletAddresses[1]
      );
    });

    it('should return a list with active eoa if has sw activity', async function () {
      sinon
        .stub(discoveryUtils, 'checkHasActivity')
        .returns(Promise.resolve(false));
      const expectedEOAAddr = FAKE_HD_NODE.address;
      const expectedSmartWalletAddresses = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ];
      callFakeOnce(
        getAddressStub,
        () => expectedSmartWalletAddresses[0],
        () => expectedSmartWalletAddresses[1]
      );

      let callCount = 0;
      getBalanceStub.callsFake(() => {
        if (callCount < 3) {
          callCount += 1;

          return Promise.resolve(BigNumber.from(1));
        }

        return Promise.resolve(BigNumber.from(0));
      });

      const actualAccounts = await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(actualAccounts).to.have.lengthOf(1);
      expect(actualAccounts[0]?.eoaAccount).to.equal(expectedEOAAddr);
      expect(actualAccounts[0]?.swAccounts[0]).to.equal(
        expectedSmartWalletAddresses[0]
      );
      expect(actualAccounts[0]?.swAccounts[1]).to.equal(
        expectedSmartWalletAddresses[1]
      );
    });

    it('should return empty list for no activity', async function () {
      sinon
        .stub(discoveryUtils, 'checkHasActivity')
        .returns(Promise.resolve(false));
      const expectedSmartWalletAddresses = [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ];
      callFakeOnce(
        getAddressStub,
        () => expectedSmartWalletAddresses[0],
        () => expectedSmartWalletAddresses[1]
      );

      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));

      const actualAccounts = await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(actualAccounts).to.have.lengthOf(0);
    });

    it('should call getSWAddress ONCE if first eoa DOES NOT have sw activity and eoa gap is 1 and sWalletGap is 1', async function () {
      sinon.stub(discoveryUtils, 'getSWAddress');

      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getAddressStub).to.have.been.calledOnce;
    });

    it('should call getSWAddress TWICE if first eoa DOES NOT have sw activity and eoa gap is 1 and sWalletGap is 2', async function () {
      sinon.stub(discoveryUtils, 'getSWAddress');

      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 2,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getAddressStub).to.have.been.calledTwice;
    });

    it('should call getSWAddress TWICE if first eoa DOES NOT have sw activity and eoa gap is 2', async function () {
      sinon.stub(discoveryUtils, 'getSWAddress');

      getBalanceStub.returns(Promise.resolve(BigNumber.from(0)));

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 2,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getAddressStub).to.have.been.calledTwice;
    });

    it('should get sw address from sw signature hash', async function () {
      const expectedSha3Result = `0x${FAKE_SHA3_RESULT.slice(26)}`;
      sha3Stub.returns(FAKE_SHA3_RESULT);

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getAddressStub).to.have.been.calledWith(expectedSha3Result);
      expect(getAddressStub).to.have.been.calledImmediatelyAfter(sha3Stub);
    });

    it('should check activity for constructed sw address', async function () {
      const expectedSha3Result = `0x${FAKE_SHA3_RESULT.slice(26)}`;
      sha3Stub.returns(FAKE_SHA3_RESULT);

      await discoverAccountsFromMnemonic(
        {
          sWalletGap: 1,
          eoaGap: 1,
        } as DiscoveryConfig,
        'mnemonic',
        ''
      );

      expect(getBalanceStub).to.have.been.called;
      expect(getBalanceStub).to.have.been.calledWith(expectedSha3Result);
      expect(getBalanceStub).to.have.been.calledImmediatelyAfter(
        getAddressStub
      );
    });
  });

  describe('discoverAccountsFromExtendedPublicKeys', function () {
    it('should call setupDiscovery with config', async function () {
      const expectedConfig = {
        sWalletGap: 0,
        eoaGap: 1,
      } as DiscoveryConfig;
      const setupDiscoveryStub = sinon
        .stub(discoveryUtils, 'setupDiscovery')
        .returns(
          Promise.resolve({
            config: expectedConfig,
            bytecodeHash: '',
            smartWalletFactory: {} as unknown as SmartWalletFactory,
            provider: {} as providers.BaseProvider,
          })
        );
      await discoverAccountsFromExtendedPublicKeys(expectedConfig, []);

      expect(setupDiscoveryStub).to.have.been.calledWith(expectedConfig);
    });

    it('should get root node for each pub key', async function () {
      const expectedPubKeys = ['pubKey1', 'pubKey2'];
      const expectedRootNodes = [
        {
          address: '0x1111111111111111111111111111111111111111',
        },
        {
          address: '0x2222222222222222222222222222222222222222',
        },
      ] as HDNode[];

      sinon.stub(discoveryUtils, 'setupDiscovery');
      sinon.stub(discoveryUtils, 'findHardenedNodeActivity');

      const getRootNodeStub = sinon
        .stub(HDNode, 'fromExtendedKey')
        .callsFake((pubKey) => {
          if (pubKey === expectedPubKeys[0]) {
            return expectedRootNodes[0] as HDNode;
          }

          return expectedRootNodes[1] as HDNode;
        });

      await discoverAccountsFromExtendedPublicKeys(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        expectedPubKeys
      );

      expect(getRootNodeStub).to.have.been.calledWith(expectedPubKeys[0]);
      expect(getRootNodeStub).to.have.been.calledWith(expectedPubKeys[1]);
    });

    it('should call findHardenedNodeActivity for each root node', async function () {
      const expectedPubKeys = ['pubKey1', 'pubKey2'];
      const expectedRootNodes = [
        {
          address: '0x1111111111111111111111111111111111111111',
        },
        {
          address: '0x2222222222222222222222222222222222222222',
        },
      ] as HDNode[];

      sinon.stub(discoveryUtils, 'setupDiscovery');
      const findHardenedNodeActivityStub = sinon.stub(
        discoveryUtils,
        'findHardenedNodeActivity'
      );

      sinon.stub(HDNode, 'fromExtendedKey').callsFake((pubKey) => {
        if (pubKey === expectedPubKeys[0]) {
          return expectedRootNodes[0] as HDNode;
        }

        return expectedRootNodes[1] as HDNode;
      });

      await discoverAccountsFromExtendedPublicKeys(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        expectedPubKeys
      );

      expect(findHardenedNodeActivityStub).to.have.been.called;
      expect(findHardenedNodeActivityStub).to.have.been.calledWith({
        rootNode: expectedRootNodes[0],
      });
      expect(findHardenedNodeActivityStub).to.have.been.calledWith({
        rootNode: expectedRootNodes[1],
      });
    });

    it('should return all accounts found', async function () {
      const expectedPubKeys = ['pubKey1', 'pubKey2'];
      const expectedRootNodes = [
        {
          address: '0x1111111111111111111111111111111111111111',
        },
        {
          address: '0x2222222222222222222222222222222222222222',
        },
      ] as HDNode[];

      sinon.stub(discoveryUtils, 'setupDiscovery');
      const findHardenedNodeActivityStub = sinon.stub(
        discoveryUtils,
        'findHardenedNodeActivity'
      );

      sinon.stub(HDNode, 'fromExtendedKey').callsFake((pubKey) => {
        if (pubKey === expectedPubKeys[0]) {
          return expectedRootNodes[0] as HDNode;
        }

        return expectedRootNodes[1] as HDNode;
      });

      const expectedAccounts: DiscoveredAccount[] = [
        {
          eoaAccount: expectedRootNodes[0]?.address as string,
          swAccounts: [],
        },
        {
          eoaAccount: expectedRootNodes[1]?.address as string,
          swAccounts: [],
        },
      ];

      callFakeOnce(
        findHardenedNodeActivityStub,
        () => Promise.resolve(expectedAccounts[0]),
        () => Promise.resolve(expectedAccounts[1])
      );

      const result = await discoverAccountsFromExtendedPublicKeys(
        {
          sWalletGap: 0,
          eoaGap: 1,
        } as DiscoveryConfig,
        expectedPubKeys
      );

      expect(result).to.deep.equal(expectedAccounts);
    });
  });
});
