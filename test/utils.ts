import crypto from 'crypto';

export const createRandomAddress = () =>
    `0x${crypto.randomBytes(20).toString('hex')}`;
export const createRandomeValue = (value: number) => `${Math.random() * value}`;
