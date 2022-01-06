/*
 * For the moment we hard-coded the trif-rbtc conversion (extracted from the original dapp)
 */
export function costInWei(maxPossibleGas: BN, gasPrice: BN) {
    return maxPossibleGas.mul(gasPrice);
}

export function getTRifWei(costInWei: BN) {
    const tRifPriceInRBTC = 0.000005739;
    const ritTokenDecimals = 18;

    const costInRBTC = web3.utils.fromWei(costInWei.toString());
    const costInTrif = parseFloat(costInRBTC) / tRifPriceInRBTC;
    const costInTrifFixed = costInTrif.toFixed(ritTokenDecimals);
    const costInTrifAsWei = web3.utils.toWei(costInTrifFixed);
    return costInTrifAsWei;
}
