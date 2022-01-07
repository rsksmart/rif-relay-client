/// <reference types="@openeth/truffle-typings" />
/// <reference types="bn.js" />
export declare function getGasCostInWei(maxPossibleGas: BN, gasPrice: BN): import("bn.js");
export declare function getTRifWei(gasCostInWei: BN): string;
