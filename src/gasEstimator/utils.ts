import type { BigNumberish, BigNumber } from 'ethers';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import { RelayHub__factory } from '@rsksmart/rif-relay-contracts';
import type {
  EnvelopingRequest,
  RelayRequest,
} from '../common/relayRequest.types';
import { isDeployRequest } from '../common/relayRequest.utils';
import type { EnvelopingTxRequest } from '../common/relayTransaction.types';
import {
  applyGasCorrectionFactor,
  ESTIMATED_GAS_CORRECTION_FACTOR,
  estimateInternalCallGas,
} from '../utils';
import { getProvider } from '../common/clientConfigurator';

const standardMaxPossibleGasEstimation = async (
  { relayRequest, metadata: { signature } }: EnvelopingTxRequest,
  relayWorkerAddress: string,
  estimatedGasCorrectionFactor?: BigNumberish
): Promise<BigNumber> => {
  const {
    request,
    relayData: { gasPrice },
  } = relayRequest;

  const provider = getProvider();

  const relayHub = RelayHub__factory.connect(
    request.relayHub.toString(),
    provider
  );

  const methodToEstimate = isDeployRequest(relayRequest)
    ? await relayHub.populateTransaction.deployCall(relayRequest, signature)
    : await relayHub.populateTransaction.relayCall(
        relayRequest as RelayRequest,
        signature
      );

  const relayEstimation = await provider.estimateGas({
    ...methodToEstimate,
    gasPrice,
    from: relayWorkerAddress,
  });

  const correctedEstimation = applyGasCorrectionFactor(
    relayEstimation,
    estimatedGasCorrectionFactor
  );

  return correctedEstimation;
};

const linearFitMaxPossibleGasEstimation = async (
  envelopingRequest: EnvelopingRequest,
  tokenEstimation: BigNumber,
  internalEstimationCorrection?: BigNumberish,
  estimatedGasCorrectionFactor?: BigNumberish
): Promise<BigNumber> => {
  if (isDeployRequest(envelopingRequest)) {
    throw Error('LinearFit estimation not implemented for deployments');
  }

  const {
    request: { data, from, to },
    relayData: { gasPrice },
  } = envelopingRequest;

  const internalEstimation = await estimateInternalCallGas({
    internalEstimationCorrection,
    estimatedGasCorrectionFactor,
    data,
    from,
    to,
    gasPrice,
  });

  const relayEstimation = estimateMaxPossibleWithLinearFit(
    internalEstimation,
    tokenEstimation
  );

  return relayEstimation;
};

/**
 * @returns maximum possible gas consumption by this relay call
 * Note that not using the linear fit would result in an Inadequate amount of gas
 * You can add another kind of estimation (a hardcoded value for example) in that "else" statement
 * if you don't then use this function with usingLinearFit = true
 */
const estimateMaxPossibleWithLinearFit = (
  relayCallGasLimit: BigNumberish,
  tokenPaymentGas: BigNumberish,
  estimatedGasCorrectionFactor = ESTIMATED_GAS_CORRECTION_FACTOR
): BigNumber => {
  const bigRelay = BigNumberJs(relayCallGasLimit.toString());
  const bigTokenPayment = BigNumberJs(tokenPaymentGas.toString());

  let estimatedCost: BigNumberJs;

  if (bigTokenPayment.isZero()) {
    // Subsidized case
    // y = a0 + a1 * x = 85090.977 + 1.067 * x
    const a0 = BigNumberJs('85090.977');
    const a1 = BigNumberJs('1.067');
    estimatedCost = a1.multipliedBy(bigRelay).plus(a0);
  } else {
    // y = a0 + a1 * x = 72530.9611 + 1.1114 * x
    const a0 = BigNumberJs('72530.9611');
    const a1 = BigNumberJs('1.1114');
    estimatedCost = a1.multipliedBy(bigRelay.plus(bigTokenPayment)).plus(a0);
  }

  return applyGasCorrectionFactor(
    estimatedCost.toFixed(0),
    estimatedGasCorrectionFactor
  );
};

export {
  standardMaxPossibleGasEstimation,
  linearFitMaxPossibleGasEstimation,
  estimateMaxPossibleWithLinearFit,
};
