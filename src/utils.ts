import {
  BigNumberish,
  BigNumber,
  Transaction,
  constants,
  utils,
  PopulatedTransaction,
} from 'ethers';
import { BigNumber as BigNumberJs } from 'bignumber.js';
import {
  ICustomSmartWalletFactory__factory,
  IERC20__factory,
  ISmartWalletFactory__factory,
  PromiseOrValue,
  RelayHub__factory,
} from '@rsksmart/rif-relay-contracts';
import log from 'loglevel';
import {
  EstimateInternalGasParams,
  getEnvelopingConfig,
  getProvider,
  isDeployRequest,
  isDeployTransaction,
  SmartWalletAddressTxOptions,
  TokenGasEstimationParams,
} from './common';
import type {
  RequestConfig,
  EnvelopingTxRequest,
  DeployRequest,
  RelayRequest,
  PaymentGasEstimationParams,
} from './common';
import {
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
  GAS_LIMIT_EXCEEDED,
} from './constants/errorMessages';
import RelayClient from './RelayClient';
import type { HttpClient } from './api/common';

const INTERNAL_TRANSACTION_ESTIMATED_CORRECTION = 18500; // When estimating the gas an internal call is going to spend, we need to substract some gas inherent to send the parameters to the blockchain
const INTERNAL_TRANSACTION_NATIVE_ESTIMATED_CORRECTION = 10500;
const ESTIMATED_GAS_CORRECTION_FACTOR = 1;
const SHA3_NULL_S = utils.keccak256('0x00');
const FACTOR = 0.25;
const GAS_VERIFICATION_ATTEMPTS = 4;

const getRelayClientGenerator = function* (httpClient?: HttpClient) {
  const { preferredRelays } = getEnvelopingConfig();

  for (const relay of preferredRelays) {
    yield new RelayClient(httpClient, relay);
  }
};

const estimateInternalCallGas = async ({
  internalEstimationCorrection,
  estimatedGasCorrectionFactor,
  ...estimateGasParams
}: EstimateInternalGasParams): Promise<BigNumber> => {
  const provider = getProvider();

  let estimation: BigNumber = await provider.estimateGas(estimateGasParams);

  const data = await estimateGasParams.data;

  if (isDataEmpty(data.toString())) {
    internalEstimationCorrection =
      INTERNAL_TRANSACTION_NATIVE_ESTIMATED_CORRECTION;
  }

  estimation = applyInternalEstimationCorrection(
    estimation,
    internalEstimationCorrection
  );

  return applyGasCorrectionFactor(estimation, estimatedGasCorrectionFactor);
};

const estimatePaymentGas = async ({
  internalEstimationCorrection,
  estimatedGasCorrectionFactor,
  preDeploySWAddress,
  relayRequest,
}: PaymentGasEstimationParams): Promise<BigNumber> => {
  const {
    request: { tokenContract, tokenAmount },
    relayData: { callForwarder, gasPrice, feesReceiver },
  } = relayRequest;

  if (tokenAmount.toString() === '0') {
    return constants.Zero;
  }

  let tokenOrigin: PromiseOrValue<string> | undefined;

  if (isDeployRequest(relayRequest)) {
    tokenOrigin = preDeploySWAddress;

    // If it is a deploy and tokenGas was not defined, then the smartwallet address
    // is required to estimate the token gas. This value should be calculated prior to
    // the call to this function
    if (!tokenOrigin || tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_SMART_WALLET_ADDRESS);
    }
  } else {
    tokenOrigin = callForwarder;

    if (tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_CALL_FORWARDER);
    }
  }

  const isNativePayment = (await tokenContract) === constants.AddressZero;

  if (isNativePayment) {
    // Ideally we should set `from` with the tokenOrigin address,
    // but the tokenOrigin may not have funds, hence the estimation will fail
    // so we set the feesReceiver as the `from` address.
    // This may be wrong in case the feesReceiver performs some operations using
    // the msg.sender address in the fallback/receive function.
    return await estimateInternalCallGas({
      from: feesReceiver,
      to: feesReceiver,
      gasPrice,
      value: tokenAmount,
      data: '0x',
    });
  }

  const provider = getProvider();
  const erc20 = IERC20__factory.connect(await tokenContract, provider);
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

/**
 * @deprecated The method was replaced by {@link estimatePaymentGas}
 */
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

  let tokenOrigin: PromiseOrValue<string> | undefined;

  if (isDeployRequest(relayRequest)) {
    tokenOrigin = preDeploySWAddress;

    // If it is a deploy and tokenGas was not defined, then the smartwallet address
    // is required to estimate the token gas. This value should be calculated prior to
    // the call to this function
    if (!tokenOrigin || tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_SMART_WALLET_ADDRESS);
    }
  } else {
    tokenOrigin = callForwarder;

    if (tokenOrigin === constants.AddressZero) {
      throw Error(MISSING_CALL_FORWARDER);
    }
  }

  const provider = getProvider();

  const erc20 = IERC20__factory.connect(await tokenContract, provider);
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

const getSmartWalletAddress = async ({
  owner,
  smartWalletIndex,
  recoverer,
  to,
  data,
  factoryAddress,
  isCustom = false,
}: SmartWalletAddressTxOptions): Promise<string> => {
  log.debug('generateSmartWallet Params', {
    smartWalletIndex,
    recoverer,
    data,
    to,
  });

  log.debug('Generating computed address for smart wallet');

  const recovererAddress = recoverer ?? constants.AddressZero;

  const logicParamsHash = data ? utils.keccak256(data) : SHA3_NULL_S;

  const logic = to ?? constants.AddressZero;

  if (isCustom && logic === constants.AddressZero) {
    throw new Error('Logic address is necessary for Custom Smart Wallet');
  }

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
        logicParamsHash,
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

const maxPossibleGasVerification = async (
  transaction: PopulatedTransaction,
  gasPrice: BigNumberish,
  gasLimit: BigNumberish,
  workerAddress: string
): Promise<{ maxPossibleGas: BigNumber; transactionResult: string }> => {
  let maxPossibleGasAttempt = BigNumber.from(gasLimit.toString());
  const provider = getProvider();

  for (let i = 0; i <= GAS_VERIFICATION_ATTEMPTS; i++) {
    try {
      log.debug(
        `attempting with gasLimit : ${maxPossibleGasAttempt.toString()}`
      );

      const transactionResult = await provider.call(
        {
          ...transaction,
          from: workerAddress,
          gasPrice,
          gasLimit: maxPossibleGasAttempt,
        },
        'pending'
      );

      return { maxPossibleGas: maxPossibleGasAttempt, transactionResult };
    } catch (e) {
      const error = e as Error;
      if (!error.message.includes('Not enough gas left')) {
        throw error;
      }
      maxPossibleGasAttempt = applyFactor(gasLimit, FACTOR * Math.pow(2, i));
    }
  }

  throw Error(GAS_LIMIT_EXCEEDED);
};

const applyFactor = (value: BigNumberish, factor: number) => {
  const bigFactor = BigNumberJs(1).plus(factor);

  return BigNumber.from(
    bigFactor
      .multipliedBy(value.toString())
      .dp(0, BigNumberJs.ROUND_DOWN)
      .toString()
  );
};

const isDataEmpty = (data: string) => {
  return ['', '0x', '0x00'].includes(data);
};

export {
  estimateInternalCallGas,
  estimatePaymentGas,
  estimateTokenTransferGas,
  getSmartWalletAddress,
  applyGasCorrectionFactor,
  applyInternalEstimationCorrection,
  INTERNAL_TRANSACTION_ESTIMATED_CORRECTION,
  INTERNAL_TRANSACTION_NATIVE_ESTIMATED_CORRECTION,
  ESTIMATED_GAS_CORRECTION_FACTOR,
  SHA3_NULL_S,
  validateRelayResponse,
  useEnveloping,
  getRelayClientGenerator,
  maxPossibleGasVerification,
  isDataEmpty,
};
