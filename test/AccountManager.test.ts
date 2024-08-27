import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { providers, Wallet } from 'ethers';
import type { Network } from '@ethersproject/providers';
import { _TypedDataEncoder, getAddress } from 'ethers/lib/utils';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import AccountManager from '../src/AccountManager';
import * as clientConfigurator from '../src/common/clientConfigurator';
import * as signer from '../src/signer/signer';
import { createRandomAddress } from './utils';
import { FAKE_RELAY_REQUEST } from './request.fakes';
import sinon from 'sinon';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

const ACCOUNTS_INITIAL_LENGTH = 3;
const randomAccounts = Array(ACCOUNTS_INITIAL_LENGTH)
  .fill(0)
  .map(() => Wallet.createRandom());

describe('AccountManager', function () {
  describe('methods', function () {
    let accountManager: AccountManager;
    let stubProvider: providers.JsonRpcProvider;
    const chainId = 1;

    beforeEach(function () {
      stubProvider = {
        ...sandbox.createStubInstance(providers.JsonRpcProvider),
        _isProvider: true,
        getNetwork: () =>
          Promise.resolve({
            chainId,
          } as Network),
      };
      sandbox.stub(_TypedDataEncoder, 'getPayload').returns('');
      sandbox.stub(clientConfigurator, 'getProvider').returns(stubProvider);
      accountManager = AccountManager.getInstance();
    });

    afterEach(function () {
      sandbox.restore();
    });

    describe('addAccount', function () {
      it('should add wallet clone to local accounts', function () {
        const wallet = Wallet.createRandom();
        accountManager.addAccount(wallet);
        const actualWallet = (
          accountManager as unknown as { _accounts: Wallet[] }
        )._accounts[0];

        expect(actualWallet === wallet, 'Clones object').to.be.false;

        expect(actualWallet?.address, 'Same address').to.equal(wallet.address);

        expect(actualWallet?.privateKey, 'Same privateKey').to.equal(
          wallet.privateKey
        );
      });

      it('should throw if private key does not generate given address', function () {
        const wallet = Wallet.createRandom();

        expect(() => {
          accountManager.addAccount({
            privateKey: wallet.privateKey,
            address: createRandomAddress(),
          } as Wallet);
        }).to.throw('invalid keypair');
      });
    });

    describe('removeAccount()', function () {
      beforeEach(function () {
        (accountManager as unknown as { _accounts: Wallet[] })._accounts =
          randomAccounts;
      });

      it('Should remove only account sent as parameter', function () {
        const expectedAccounts = [
          randomAccounts[0]?.address,
          randomAccounts[2]?.address,
        ];

        accountManager.removeAccount(randomAccounts[1]?.address as string);

        expect(accountManager.getAccounts()).to.be.deep.equal(expectedAccounts);
      });

      it('Should throw an error if the account sent as parameter does not exists', function () {
        const nonexistentWallet = Wallet.createRandom();

        expect(() =>
          accountManager.removeAccount(nonexistentWallet.address)
        ).to.throw('Account not found');
      });
    });

    describe('getAccounts', function () {
      it('should return list of local account addresses from', function () {
        const wallets: Wallet[] = [
          Wallet.createRandom(),
          Wallet.createRandom(),
          Wallet.createRandom(),
        ];
        const expectedAddresses: string[] = wallets.map((w) => w.address);

        (
          accountManager as unknown as {
            _accounts: Wallet[];
          }
        )._accounts = wallets;

        expect(accountManager.getAccounts()).to.deep.equal(expectedAddresses);
      });
    });

    describe('sign', function () {
      let wallet: Wallet;

      beforeEach(function () {
        wallet = Wallet.createRandom();
        accountManager.addAccount(wallet);
      });

      it('Should sign with local account', async function () {
        const stub = sandbox
          .stub(signer, 'signEnvelopingRequest')
          .resolves('signature');

        const relayRequest = {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            from: wallet.address,
          },
        };
        await accountManager.sign(relayRequest);

        expect(stub).to.be.calledWith(
          relayRequest,
          getAddress(wallet.address),
          sinon.match({ address: wallet.address })
        );
      });

      it('Should sign with wallet sent as parameter', async function () {
        const stub = sandbox
          .stub(signer, 'signEnvelopingRequest')
          .resolves('signature');

        const newWallet = Wallet.createRandom();

        const relayRequest = {
          ...FAKE_RELAY_REQUEST,
          request: {
            ...FAKE_RELAY_REQUEST.request,
            from: newWallet.address,
          },
        };

        await accountManager.sign(relayRequest, newWallet);

        expect(stub).to.be.calledWith(
          relayRequest,
          getAddress(newWallet.address),
          sinon.match({ address: newWallet.address })
        );
      });
    });
  });
});
