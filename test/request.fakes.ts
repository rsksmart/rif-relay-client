import { constants, ethers, Wallet } from 'ethers';
import type { EnvelopingMetadata } from '../src/common/relayHub.types';
import type {
  CommonEnvelopingRequestBody,
  DeployRequest,
  DeployRequestBody,
  EnvelopingRequestData,
  RelayRequest,
  RelayRequestBody,
} from '../src/common/relayRequest.types';
import type {
  DeployTransactionRequest,
  RelayTransactionRequest,
} from '../src/common/relayTransaction.types';

const COMMON_REQUEST_BODY: CommonEnvelopingRequestBody = {
  data: 'FAKE_REQUEST_DATA',
  tokenGas: constants.Two,
  nonce: constants.Two,
  relayHub: Wallet.createRandom().address,
  from: Wallet.createRandom().address,
  to: Wallet.createRandom().address,
  tokenAmount: constants.Two,
  tokenContract: Wallet.createRandom().address,
  value: constants.Two,
};

const RELAY_REQUEST_BODY: RelayRequestBody = {
  ...COMMON_REQUEST_BODY,
  gas: constants.Two,
};

const DEPLOY_REQUEST_BODY: DeployRequestBody = {
  ...COMMON_REQUEST_BODY,
  index: constants.Two,
  recoverer: Wallet.createRandom().address,
};

const ENVELOPING_REQUEST_DATA: EnvelopingRequestData = {
  callForwarder: Wallet.createRandom().address,
  callVerifier: Wallet.createRandom().address,
  feesReceiver: Wallet.createRandom().address,
  gasPrice: constants.Two,
};

const RELAY_REQUEST: RelayRequest = {
  relayData: ENVELOPING_REQUEST_DATA,
  request: RELAY_REQUEST_BODY,
};

const DEPLOY_REQUEST: DeployRequest = {
  relayData: ENVELOPING_REQUEST_DATA,
  request: DEPLOY_REQUEST_BODY,
};

const ENVELOPING_REQUEST_METADATA: EnvelopingMetadata = {
  relayHubAddress: COMMON_REQUEST_BODY.relayHub,
  relayMaxNonce: COMMON_REQUEST_BODY.nonce,
  signature: ethers.utils.randomBytes(129).toString(),
};

const RELAY_TRANSACTION_REQUEST: RelayTransactionRequest = {
  metadata: ENVELOPING_REQUEST_METADATA,
  relayRequest: RELAY_REQUEST,
};

const DEPLOY_TRANSACTION_REQUEST: DeployTransactionRequest = {
  metadata: ENVELOPING_REQUEST_METADATA,
  relayRequest: DEPLOY_REQUEST,
};

export {
  COMMON_REQUEST_BODY as FAKE_COMMON_REQUEST_BODY,
  RELAY_REQUEST_BODY as FAKE_RELAY_REQUEST_BODY,
  DEPLOY_REQUEST as FAKE_DEPLOY_REQUEST,
  ENVELOPING_REQUEST_DATA as FAKE_ENVELOPING_REQUEST_DATA,
  RELAY_REQUEST as FAKE_RELAY_REQUEST,
  ENVELOPING_REQUEST_METADATA as FAKE_ENVELOPING_REQUEST_METADATA,
  RELAY_TRANSACTION_REQUEST as FAKE_RELAY_TRANSACTION_REQUEST,
  DEPLOY_TRANSACTION_REQUEST as FAKE_DEPLOY_TRANSACTION_REQUEST,
};
