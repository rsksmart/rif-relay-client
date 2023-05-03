const MISSING_SMART_WALLET_ADDRESS =
  'Missing smart wallet address in requestConfig. Should be calculated before estimating the gas cost for a deploy transaction';
const MISSING_CALL_FORWARDER = 'Missing call forwarder in a relay request';
const MISSING_REQUEST_FIELD = (field: string) =>
  `Field ${field} is not defined in request body.`;
const GAS_LIMIT_EXCEEDED = 'gasLimit exceeded';

export {
  MISSING_SMART_WALLET_ADDRESS,
  MISSING_CALL_FORWARDER,
  MISSING_REQUEST_FIELD,
  GAS_LIMIT_EXCEEDED,
};
