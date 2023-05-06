import { BigNumber, Wallet } from 'ethers';

export const createRandomAddress = () => Wallet.createRandom().address;
export const createRandomValue = (value: number) =>
  `${(Math.random() * value).toFixed(0)}`;
export const createRandomBigNumber = (value: number) =>
  BigNumber.from((Math.random() * value).toFixed(0));
