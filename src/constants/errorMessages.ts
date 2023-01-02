import { ENVELOPING_ROOT } from './configs';

const MISSING_CONFIG_ROOT = `Could not read enveloping configuration. Make sure your configuration is nested under ${ENVELOPING_ROOT} key.`;
const MISSING_SMART_WALLET_ADDRESS =
  'Missing smart wallet address in requestConfig. Should be calculated before estimating the gas cost for a deploy transaction';
const MISSING_CALL_FORWARDER = 'Missing call forwarder in EnvelopingRequest.';
const NOT_RELAYED_TRANSACTION = 'Transaction was not relayed through any hub';

export {
  MISSING_CONFIG_ROOT,
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
  NOT_RELAYED_TRANSACTION,
};
