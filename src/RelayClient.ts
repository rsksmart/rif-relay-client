import {
  EnvelopingTransactionDetails,
  ESTIMATED_GAS_CORRECTION_FACTOR,
} from '@rsksmart/rif-relay-common';
import { BigNumber, BigNumberish, getDefaultProvider, providers } from 'ethers';
import { BigNumber as BigNumberJs } from 'bignumber.js';

class RelayClient {
  private readonly _provider: providers.Provider;

  constructor() {
    this._provider = getDefaultProvider();
  }

  async estimateInternalCallGas(
    transactionDetails: EnvelopingTransactionDetails,
    internalGasCorrection: BigNumberish,
    addCorrection = true
  ): Promise<BigNumber> {
    let estimation = await this._provider.estimateGas({
      from: transactionDetails.from,
      to: transactionDetails.to,
      gasPrice: transactionDetails.gasPrice,
      data: transactionDetails.data,
    });

    // The INTERNAL_TRANSACTION_ESTIMATE_CORRECTION is substracted because the estimation is done using web3.eth.estimateGas which
    // estimates the call as if it where an external call, and in our case it will be called internally (it's not the same cost).
    // Because of this, the estimated maxPossibleGas in the server (which estimates the whole transaction) might not be enough to successfully pass
    // the following verification made in the SmartWallet:
    // require(gasleft() > req.gas, "Not enough gas left"). This is done right before calling the destination internally
    if (estimation.gt(internalGasCorrection)) {
      estimation = estimation.sub(internalGasCorrection);
    }

    if (addCorrection) {
      estimation = this._applyGasCorrectionFactor(estimation);
    }

    return estimation;
  }

  private _applyGasCorrectionFactor(estimation: BigNumberish): BigNumber {
    let bigEstimation = BigNumberJs(estimation.toString());
    const bigGasCorrection = BigNumberJs(
      ESTIMATED_GAS_CORRECTION_FACTOR.toString()
    );

    if (!bigGasCorrection.isEqualTo(1)) {
      bigEstimation = bigEstimation.multipliedBy(bigGasCorrection);
    }

    return BigNumber.from(bigEstimation.toFixed());
  }
}

export { RelayClient };
