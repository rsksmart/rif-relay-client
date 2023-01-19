import type { HttpClient } from './api/common';
import { BigNumberish, BigNumber, Transaction, constants } from 'ethers';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import {
  ICustomSmartWalletFactory__factory,
  IERC20__factory,
  ISmartWalletFactory__factory,
  RelayHub__factory,
} from '@rsksmart/rif-relay-contracts';
import log from 'loglevel';
import {
  EstimateInternalGasParams,
  getEnvelopingConfig,
  getProvider,
  isDeployRequest,
  isDeployTransaction,
  TokenGasEstimationParams,
} from './common';
import type {
  RequestConfig,
  EnvelopingTxRequest,
  DeployRequest,
  RelayRequest,
  RelayInfo,
} from './common';
import {
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
} from './constants/errorMessages';

const INTERNAL_TRANSACTION_ESTIMATED_CORRECTION = 20000; // When estimating the gas an internal call is going to spend, we need to substract some gas inherent to send the parameters to the blockchain
const ESTIMATED_GAS_CORRECTION_FACTOR = 1;

const selectNextRelay = async (httpClient: HttpClient): Promise<RelayInfo> => {
  const { preferredRelays } = getEnvelopingConfig();

  for (const preferredRelay of preferredRelays ?? []) {
    let hubInfo;
    let managerData;

    try {
      hubInfo = await httpClient.getChainInfo(preferredRelay);

      if (hubInfo.ready) {
        const relayHub = RelayHub__factory.connect(
          hubInfo.relayHubAddress,
          getProvider()
        );
        managerData = await relayHub.getRelayInfo(hubInfo.relayManagerAddress);

        return {
          hubInfo,
          managerData,
        };
      }
    } catch (error) {
      log.warn('Failed to getChainInfo from hub', error);
      continue;
    }
  }

  log.error('No more hubs available to select');

  throw new Error('No more hubs available to select');
};

const estimateInternalCallGas = async ({
  internalEstimationCorrection,
  estimatedGasCorrectionFactor,
  ...estimateGasParams
}: EstimateInternalGasParams): Promise<BigNumber> => {
  const provider = getProvider();

  let estimation: BigNumber = await provider.estimateGas(estimateGasParams);

  estimation = applyInternalEstimationCorrection(
    estimation,
    internalEstimationCorrection
  );

  return applyGasCorrectionFactor(estimation, estimatedGasCorrectionFactor);
};

const estimateTokenTransferGas = async ({
  internalEstimationCorrection,
  estimatedGasCorrectionFactor,
  preDeploySWAddress,
  relayRequest,
}: TokenGasEstimationParams): Promise<BigNumber> => {
  const {
    request: { tokenContract, tokenAmount },
    relayData: { callForwarder, gasPrice, feesReceiver },
  } = relayRequest;

  if (!Number(tokenContract) || tokenAmount.toString() === '0') {
    return constants.Zero;
  }

  let tokenOrigin: string | undefined;

  if (isDeployRequest(relayRequest)) {
    tokenOrigin = preDeploySWAddress;

    // If it is a deploy and tokenGas was not defined, then the smartwallet address
    // is required to estimate the token gas. This value should be calculated prior to
    // the call to this function
    if (!tokenOrigin || tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_SMART_WALLET_ADDRESS);
    }
  } else {
    tokenOrigin = callForwarder.toString();

    if (tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_CALL_FORWARDER);
    }
  }

  const provider = getProvider();

  const erc20 = IERC20__factory.connect(tokenContract.toString(), provider);
  const gasCost = await erc20.estimateGas.transfer(feesReceiver, tokenAmount, {
    from: tokenOrigin,
    gasPrice,
  });

  const internalCallCost = applyInternalEstimationCorrection(
    gasCost,
    internalEstimationCorrection
  );

  return applyGasCorrectionFactor(
    internalCallCost,
    estimatedGasCorrectionFactor
  );
};

const getSmartWalletAddress = async (
  owner: string,
  smartWalletIndex: number | string,
  recoverer?: string,
  logic?: string,
  logicParamsHash?: string,
  factoryAddress?: string
): Promise<string> => {
  log.debug('generateSmartWallet Params', {
    smartWalletIndex,
    recoverer,
    logic,
    logicParamsHash,
  });

  const isCustom = !!logic && logic !== constants.AddressZero;

  log.debug('Generating computed address for smart wallet');

  const recovererAddress = recoverer ?? constants.AddressZero;

  const initParamsHash = logicParamsHash ?? '0x00';

  const smartWalletFactoryAddress =
    factoryAddress ?? getEnvelopingConfig().smartWalletFactoryAddress;

  const provider = getProvider();

  const smartWalletAddress = isCustom
    ? await ICustomSmartWalletFactory__factory.connect(
        smartWalletFactoryAddress,
        provider
      ).getSmartWalletAddress(
        owner,
        recovererAddress,
        logic,
        initParamsHash,
        smartWalletIndex
      )
    : await ISmartWalletFactory__factory.connect(
        smartWalletFactoryAddress,
        provider
      ).getSmartWalletAddress(owner, recovererAddress, smartWalletIndex);

  return smartWalletAddress;
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

/**
 * Decode the signed transaction returned from the Relay Server, compare it to the
 * requested transaction and validate its signature.
 */
const validateRelayResponse = (
  request: EnvelopingTxRequest,
  transaction: Transaction,
  relayWorkerAddress: string
): void => {
  const {
    to: txDestination,
    from: txOrigin,
    nonce: txNonce,
    data: txData,
  } = transaction;
  const {
    metadata: { signature, relayMaxNonce },
    relayRequest,
  } = request;
  const requestMaxNonce = BigNumber.from(relayMaxNonce).toNumber();
  log.debug('validateRelayResponse - Transaction is', transaction);

  if (!txDestination) {
    throw Error('Transaction has no recipient address');
  }

  if (!txOrigin) {
    throw Error('Transaction has no signer');
  }

  const isDeploy = isDeployTransaction(request);

  const provider = getProvider();
  const envelopingConfig = getEnvelopingConfig();

  const relayHub = RelayHub__factory.connect(
    envelopingConfig.relayHubAddress,
    provider
  );

  const encodedEnveloping = isDeploy
    ? relayHub.interface.encodeFunctionData('deployCall', [
        relayRequest as DeployRequest,
        signature,
      ])
    : relayHub.interface.encodeFunctionData('relayCall', [
        relayRequest as RelayRequest,
        signature,
      ]);

  if (txNonce > requestMaxNonce) {
    // TODO: need to validate that client retries the same request and doesn't double-spend.
    // Note that this transaction is totally valid from the EVM's point of view
    throw new Error(
      `Relay used a tx nonce higher than requested. Requested ${requestMaxNonce} got ${txNonce}`
    );
  }

  if (
    txDestination.toLowerCase() !==
    envelopingConfig.relayHubAddress.toLowerCase()
  ) {
    throw new Error('Transaction recipient must be the RelayHubAddress');
  }

  if (encodedEnveloping !== txData) {
    throw new Error(
      'Relay request Encoded data must be the same as Transaction data'
    );
  }

  if (relayWorkerAddress.toLowerCase() !== txOrigin.toLowerCase()) {
    throw new Error(
      'Transaction sender address must be the same as configured relayWorker address'
    );
  }

  log.info('validateRelayResponse - valid transaction response');
};

const useEnveloping = (
  method: string,
  params: Array<Record<string, unknown>>
): boolean => {
  if (method === 'eth_accounts') {
    return true;
  }

  const [a] = params;

  if (!a) {
    return false;
  }

  const { envelopingTx, requestConfig } = a;
  if (
    envelopingTx &&
    requestConfig &&
    (requestConfig as RequestConfig).useEnveloping
  ) {
    return true;
  }

  return false;
};

export {
  selectNextRelay,
  estimateInternalCallGas,
  estimateTokenTransferGas,
  getSmartWalletAddress,
  applyGasCorrectionFactor,
  applyInternalEstimationCorrection,
  INTERNAL_TRANSACTION_ESTIMATED_CORRECTION,
  ESTIMATED_GAS_CORRECTION_FACTOR,
  validateRelayResponse,
  useEnveloping,
};
