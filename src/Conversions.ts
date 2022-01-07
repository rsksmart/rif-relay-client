/*
 * For the moment we hard-coded the trif-rbtc conversion (extracted from the original dapp)
 */
export function getGasCostInWei(maxPossibleGas: BN, gasPrice: BN) {
    return maxPossibleGas.mul(gasPrice);
}
/*
 * TODO: Hard-coded values: for testing purposes only!
 * This is specific for the tRIF token.
 */
export function getTRifWei(gasCostInWei: BN) {
    const tRifPriceInRBTC = 0.000005739;
    const ritTokenDecimals = 18;

    const costInRBTC = web3.utils.fromWei(gasCostInWei.toString());
    const costInTrif = parseFloat(costInRBTC) / tRifPriceInRBTC;
    const costInTrifFixed = costInTrif.toFixed(ritTokenDecimals);
    const costInTrifAsWei = web3.utils.toWei(costInTrifFixed);
    return costInTrifAsWei;
}
