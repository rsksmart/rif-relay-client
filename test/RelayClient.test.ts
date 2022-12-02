import type { EnvelopingTransactionDetails } from '@rsksmart/rif-relay-common';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { createSandbox, SinonStubbedInstance } from 'sinon';
import sinonChai from 'sinon-chai';
import { RelayClient } from '../src/RelayClient';
import { createRandomAddress } from './utils';
import { providers, BigNumber } from 'ethers';

use(sinonChai);
use(chaiAsPromised);

const sandbox = createSandbox();

describe('RelayClient', function () {

    describe('constructor', function () {

        afterEach(function () {
            sandbox.restore();
        });

        it('should store provider', function () {
            const expectedProvider: providers.BaseProvider = sandbox.createStubInstance(
                providers.JsonRpcProvider
              );
            const relayClient = new RelayClient();

            (relayClient as unknown as { _provider: providers.Provider })
                  ._provider = expectedProvider;
            expect(relayClient).to.be.instanceOf(RelayClient);
            expect(
                (relayClient as unknown as { _provider: providers.Provider })
                  ._provider,
                'Provider'
              ).to.equal(expectedProvider);
        });
    });

    describe('getInternalGasEstimation', function () {
        let provider: SinonStubbedInstance<providers.BaseProvider>;
        let relayClient: RelayClient;
        let transactionDetails: EnvelopingTransactionDetails;

        beforeEach(function(){
            transactionDetails = {
                from:  createRandomAddress(),
                to: createRandomAddress(),
                data: '0x01'
            };
            relayClient = new RelayClient();
            provider = sandbox.createStubInstance(providers.JsonRpcProvider);
            (relayClient as unknown as { _provider: providers.Provider })
                  ._provider = provider;
        });

        afterEach(function(){
            sandbox.restore();
        })

        it('should return the estimation applying the internal correction', async function(){
            const estimateGas = BigNumber.from(10000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimation = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection);
            const expectedEstimation = estimateGas.sub(internalGasCorrection);
            expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
        });

        it('should return the estimation without applying the internal correction', async function(){
            const estimateGas = BigNumber.from(4000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimation = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection);
            const expectedEstimation = estimateGas;
            expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
        });

        it('should return estimation without applying gas correction factor', async function(){
            const stubApplyGasCorrection = sandbox.stub(relayClient as unknown as {
                _applyGasCorrectionFactor: () => BigNumber;
            }, '_applyGasCorrectionFactor'
             ).returns(BigNumber.from(7500));
            const estimateGas = BigNumber.from(10000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimation = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection, false);
            const expectedEstimation = estimateGas.sub(internalGasCorrection);
            expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
            expect(stubApplyGasCorrection.calledOnce).to.be.false;
        });

        it('should return estimation applying gas correction factor', async function(){
            const expectedEstimation = BigNumber.from(7500);
            const stubApplyGasCorrection = sandbox.stub(relayClient as unknown as {
                _applyGasCorrectionFactor: () => BigNumber;
            }, '_applyGasCorrectionFactor'
             ).returns(expectedEstimation);
            const estimateGas = BigNumber.from(10000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimation = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection);
            expect(estimation.toString()).to.be.equal(expectedEstimation.toString());
            expect(stubApplyGasCorrection.calledOnce).to.be.true;
        });

       /*  it('should truncate internalGasCorrection while doing estimation', async function(){
            const estimateGas = BigNumber.from(4000);
            provider.estimateGas.returns(Promise.resolve(estimateGas));
            const internalGasCorrection = 5000;
            const estimaton = await relayClient.estimateInternalCallGas(transactionDetails, internalGasCorrection);
            const expectedEstimation = estimateGas;
            expect(estimaton.toString()).to.be.equal(expectedEstimation.toString());
        }); */

    });

});