import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { constants, providers, Wallet } from 'ethers';
import type { Network } from '@ethersproject/providers';
import { _TypedDataEncoder } from 'ethers/lib/utils';
import Sinon, { createSandbox } from 'sinon';
import sinonChai from 'sinon-chai';
import * as typedDataUtils from '../../src/typedRequestData.utils';
import * as common from '../../src/common/relayRequest.utils';
import * as clientConfigurator from '../../src/common/clientConfigurator';
import * as signerUtils from '../../src/signer/utils';
import { signEnvelopingRequest } from '../../src/signer';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

const createRandomAddress = () => Wallet.createRandom().address;

const relayOrDeployRequest = {
  relayData: {
    callForwarder: createRandomAddress(),
    callVerifier: createRandomAddress(),
    feesReceiver: createRandomAddress(),
    gasPrice: constants.One,
  },
  request: {
    data: '0x',
    from: createRandomAddress(),
    nonce: constants.One,
    relayHub: createRandomAddress(),
    to: createRandomAddress(),
    tokenAmount: constants.One,
    tokenContract: createRandomAddress(),
    tokenGas: constants.One,
    value: constants.One,
    validUntilTime: 0,
  },
};
const relayRequest = {
  ...relayOrDeployRequest,
  request: {
    ...relayOrDeployRequest.request,
    gas: constants.One,
  },
};

describe('signer', function () {
  let stubProvider: providers.JsonRpcProvider;
  const chainId = 1;
  let fromAddress: string;

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
    fromAddress = relayRequest.request.from;
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('signEnvelopingRequest', function () {
    it('should check the type of request', async function () {
      const stubIsDeployRequest = sandbox.stub(common, 'isDeployRequest');
      await signEnvelopingRequest(relayRequest, fromAddress).catch(
        () => undefined
      );

      expect(stubIsDeployRequest).to.be.calledWith(relayRequest);
    });

    it('should construct typed message', async function () {
      const expectedMessage = {
        types: {
          RelayRequest: typedDataUtils.relayRequestType,
          RelayData: typedDataUtils.relayDataType,
        },
        primaryType: 'RelayRequest',
        domain: typedDataUtils.getDomainSeparator(
          relayRequest.relayData.callForwarder,
          1
        ),
        value: {
          ...relayRequest.request,
          relayData: relayRequest.relayData,
        },
      };

      const stubRecoverSignature = sandbox
        .stub(signerUtils, 'recoverSignature')
        .callsFake(() => relayRequest.request.from.toString());
      await signEnvelopingRequest(relayRequest, fromAddress);

      expect(stubRecoverSignature).to.be.calledWith(
        expectedMessage,
        sandbox.match.any
      );
    });

    it('should verify the request originator address against recovered typed signature', async function () {
      sandbox
        .stub(signerUtils, 'recoverSignature')
        .callsFake(() => createRandomAddress());

      await expect(
        signEnvelopingRequest(relayRequest, fromAddress)
      ).to.eventually.be.rejectedWith('signature is not correct');
    });

    it('should return signature', async function () {
      const expectedSignature = createRandomAddress();
      sandbox
        .stub(signerUtils, 'recoverSignature')
        .callsFake(() => relayRequest.request.from.toString());
      sandbox
        .stub(signerUtils, 'signWithProvider')
        .callsFake(() => Promise.resolve(expectedSignature));
      const actualSignature = await signEnvelopingRequest(
        relayRequest,
        fromAddress
      );

      expect(actualSignature).to.eq(expectedSignature);
    });

    it('should sign with provider if no local wallet of the relay originator exists', async function () {
      sandbox
        .stub(signerUtils, 'recoverSignature')
        .callsFake(() => relayRequest.request.from.toString());
      const stubSignWithProvider = sandbox.stub(
        signerUtils,
        'signWithProvider'
      );
      await signEnvelopingRequest(relayRequest, fromAddress);

      expect(stubSignWithProvider).to.be.called;
    });

    describe('When the wallet used for signature is sent as parameter', function () {
      let signerWallet: Wallet;
      let stubSignWithWallet: Sinon.SinonStub;

      beforeEach(function () {
        signerWallet = Wallet.createRandom();
        stubSignWithWallet = sandbox.stub(signerUtils, 'signWithWallet');
        relayRequest.request.from = signerWallet.address;
      });

      it('Should sign with wallet sent as parameter', async function () {
        sandbox
          .stub(signerUtils, 'recoverSignature')
          .callsFake(() => relayRequest.request.from.toString());

        await signEnvelopingRequest(
          relayRequest,
          signerWallet.address,
          signerWallet
        );

        expect(stubSignWithWallet).to.be.calledWith(signerWallet);
      });

      it('Should fail if the from in request does not correspond to wallet sent as parameter', async function () {
        sandbox
          .stub(signerUtils, 'recoverSignature')
          .callsFake(() => createRandomAddress());

        await expect(
          signEnvelopingRequest(
            relayRequest,
            signerWallet.address,
            signerWallet
          )
        ).to.be.rejectedWith(
          'Internal RelayClient exception: signature is not correct:'
        );
      });
    });
  });
});
