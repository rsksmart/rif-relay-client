import config from 'config';
import type { HttpClient } from './api/common';
import type { EnvelopingConfig } from './common/config.types';
import type { RelayInfo } from './common/relayHub.types';
import { ENVELOPING_ROOT } from './constants/configs';
import { BigNumberish, BigNumber } from 'ethers';
import { BigNumber as BigNumberJs } from 'bignumber.js';

const INTERNAL_TRANSACTION_ESTIMATED_CORRECTION = 20000; // When estimating the gas an internal call is going to spend, we need to substract some gas inherent to send the parameters to the blockchain
const ESTIMATED_GAS_CORRECTION_FACTOR = 1;

const getEnvelopingConfig = () => {
  try {
    return config.get<EnvelopingConfig>(ENVELOPING_ROOT);
  } catch {
    throw new Error(
      `Could not read enveloping configuration. Make sure your configuration is nested under ${ENVELOPING_ROOT} key.`
    );
  }
};

const selectNextRelay = async (
  httpClient: HttpClient
): Promise<RelayInfo | undefined> => {
  const { preferredRelays } = getEnvelopingConfig();

  for (const relayInfo of preferredRelays ?? []) {
    let hubInfo;

    try {
      hubInfo = await httpClient.getChainInfo(relayInfo.url);
    } catch (error) {
      continue;
    }

    if (hubInfo.ready) {
      return {
        hubInfo,
        relayInfo,
      };
    }
  }

  return undefined;
};

// The INTERNAL_TRANSACTION_ESTIMATE_CORRECTION is substracted because the estimation is done using web3.eth.estimateGas which
// estimates the call as if it where an external call, and in our case it will be called internally (it's not the same cost).
// Because of this, the estimated maxPossibleGas in the server (which estimates the whole transaction) might not be enough to successfully pass
// the following verification made in the SmartWallet:
// require(gasleft() > req.gas, "Not enough gas left"). This is done right before calling the destination internally
const applyGasCorrectionFactor = (
  estimation: BigNumberish,
  esimatedGasCorrectFactor: BigNumberish = ESTIMATED_GAS_CORRECTION_FACTOR
): BigNumber => {
  if (esimatedGasCorrectFactor.toString() !== '1') {
    const bigGasCorrection = BigNumberJs(esimatedGasCorrectFactor.toString());
    let bigEstimation = BigNumberJs(estimation.toString());
    bigEstimation = bigEstimation.multipliedBy(bigGasCorrection);

    return BigNumber.from(bigEstimation.toFixed());
  }

  return BigNumber.from(estimation);
};

const applyInternalEstimationCorrection = (
  estimation: BigNumberish,
  internalTransactionEstimationCorrection: BigNumberish = INTERNAL_TRANSACTION_ESTIMATED_CORRECTION
) => {
  const estimationBN = BigNumber.from(estimation);

  if (estimationBN.gt(internalTransactionEstimationCorrection)) {
    return estimationBN.sub(internalTransactionEstimationCorrection);
  }

  return estimationBN;
};

export {
  getEnvelopingConfig,
  selectNextRelay,
  applyGasCorrectionFactor,
  applyInternalEstimationCorrection,
  INTERNAL_TRANSACTION_ESTIMATED_CORRECTION,
  ESTIMATED_GAS_CORRECTION_FACTOR,
};
