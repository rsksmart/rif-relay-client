import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { providers, Wallet } from 'ethers';
import { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import AccountManager from '../src/AccountManager';
import * as typedDataUtils from '../src/typedRequestData.utils';
import { createRandomAddress } from './utils';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

const relayOrDeployRequest = {
  relayData: {
    callForwarder: createRandomAddress(),
    callVerifier: createRandomAddress(),
    feesReceiver: createRandomAddress(),
    gasPrice: Math.random() * 1000,
  },
  request: {
    data: '',
    from: createRandomAddress(),
    nonce: Math.random() * 1e16,
    relayHub: createRandomAddress(),
    to: createRandomAddress(),
    tokenAmount: Math.random() * 1e16,
    tokenContract: createRandomAddress(),
    tokenGas: Math.random() * 1000,
    value: Math.random() * 1e16,
  },
};
const relayRequest = {
  ...relayOrDeployRequest,
  request: {
    ...relayOrDeployRequest.request,
    gas: Math.random() * 1000,
  },
};
const deployRequest = {
  ...relayOrDeployRequest,
  request: {
    ...relayOrDeployRequest.request,
    index: Math.random() * 100,
    recoverer: createRandomAddress(),
  },
};

describe('AccountManager', function () {
  describe('constructor', function () {
    
    after(function () {
      sandbox.restore();
    });

    afterEach(function () {
      sandbox.restore();
    });

    it('should store signer and chain id', function () {
      const expectedProvider: providers.Provider = sandbox.createStubInstance(
        providers.JsonRpcProvider
      );
      const expectedChainId = Math.random() * 100;
      const accountManager = new AccountManager(
        expectedProvider,
        expectedChainId
      );

      expect(
        (accountManager as unknown as { _provider: providers.Provider })
          ._provider,
        'Provider'
      ).to.equal(expectedProvider);
      expect(accountManager.chainId, 'Chain ID').to.equal(expectedChainId);
    });

    describe('', function () {
      let accountManager: AccountManager;
      let stubProvider: providers.JsonRpcProvider;

      beforeEach(function () {
        stubProvider = {
          ...sandbox.createStubInstance(providers.JsonRpcProvider),
          _isProvider: true,
        };

        accountManager = new AccountManager(stubProvider, 1);
      });

      describe('addAccount', function () {
        it('should add wallet clone to local accounts', function () {
          const wallet = Wallet.createRandom();
          accountManager.addAccount(wallet);
          const actualWallet = (
            accountManager as unknown as { _accounts: Wallet[] }
          )._accounts[0];

          expect(actualWallet === wallet, 'Clones object').to.be.false;

          expect(actualWallet?.address, 'Same address').to.equal(
            wallet.address
          );

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

      describe('isDeployRequest', function () {
        it('should return `true` if arg is a deploy request', function () {
          const actualState = accountManager.isDeployRequest(deployRequest);

          expect(actualState).to.be.true;
        });

        it('should return `false` if arg is a relay request', function () {
          const actualState = accountManager.isDeployRequest(relayRequest);

          expect(actualState).to.be.false;
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
        it('should check the type of request', async function () {
          const stubIsDeployRequest = sandbox.stub(
            accountManager,
            'isDeployRequest'
          );
          await accountManager.sign(relayRequest).catch(() => undefined);

          expect(stubIsDeployRequest).to.be.calledWith(relayRequest);
        });

        it('should construct typed message', async function () {
          (accountManager as unknown as { _accounts: Wallet[] })._accounts.push(
            Wallet.createRandom()
          );
          const expectedMessage = {
            types: {
              EIP712Domain: typedDataUtils.eip712DomainType,
              RelayRequest: typedDataUtils.relayRequestType,
              RelayData: typedDataUtils.relayDataType,
            },
            primaryType: 'RelayRequest',
            domain: typedDataUtils.getDomainSeparator(
              relayRequest.relayData.callForwarder ,
              accountManager.chainId
            ),
            message: {
              ...relayRequest.request,
              relayData: relayRequest.relayData,
            },
          };
          const stubRecoverSignature = sandbox
            .stub(
              accountManager as unknown as {
                _recoverSignature: () => string;
              },
              '_recoverSignature'
            )
            .callsFake(() => relayRequest.request.from.toString());
          await accountManager.sign(relayRequest);

          expect(stubRecoverSignature).to.be.calledWith(
            expectedMessage,
            sandbox.match.any
          );
        });

        it('should verify the request originator address against recovered typed signature', async function () {
          sandbox
            .stub(
              accountManager as unknown as {
                _recoverSignature: () => string;
              },
              '_recoverSignature'
            )
            .callsFake(() => createRandomAddress());

          await expect(
            accountManager.sign(relayRequest)
          ).to.eventually.be.rejectedWith('signature is not correct');
        });

        it('should return signature', async function () {
          const expectedSignature = createRandomAddress();
          sandbox
            .stub(
              accountManager as unknown as {
                _recoverSignature: () => string;
              },
              '_recoverSignature'
            )
            .callsFake(() => relayRequest.request.from.toString());
          sandbox
            .stub(
              accountManager as unknown as {
                _signWithProvider: () => string;
              },
              '_signWithProvider'
            )
            .callsFake(() => expectedSignature);
          const actualSignature = await accountManager.sign(relayRequest);

          expect(actualSignature).to.eq(expectedSignature);
        });

        it('should sign with provider if no local wallet of the relay originator exists', async function () {
          sandbox
            .stub(
              accountManager as unknown as {
                _recoverSignature: () => string;
              },
              '_recoverSignature'
            )
            .callsFake(() => relayRequest.request.from.toString());
          const stubSignWithProvider = sandbox.stub(
            accountManager as unknown as {
              _signWithProvider: () => string;
            },
            '_signWithProvider'
          );
          await accountManager.sign(relayRequest);

          expect(stubSignWithProvider).to.be.called;
        });

        it('should sign with wallet if one exists locally', async function () {
          (accountManager as unknown as { _accounts: Wallet[] })._accounts.push(
            {
              ...Wallet.createRandom(),
              address: relayRequest.request.from.toString(),
            } as Wallet
          );
          sandbox
            .stub(
              accountManager as unknown as {
                _recoverSignature: () => string;
              },
              '_recoverSignature'
            )
            .callsFake(() => relayRequest.request.from.toString());
          const stubSignWithWallet = sandbox.stub(
            accountManager as unknown as {
              _signWithWallet: () => string;
            },
            '_signWithWallet'
          );
          await accountManager.sign(relayRequest);

          expect(stubSignWithWallet).to.be.called;
        });
      });
    });
  });
});
