import { Roles, PerNetwork } from '../types';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';

export const roles: PerNetwork<Roles> = {
  '42': {
    admin: A('0x81ccE2d050dEfB2d8F79946e4D0714c170cDe410'),
    maintainer: A('0x8B4AC947A5866693cB9AB930E72E0546ABe04679'),
    liquidityProvider: A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
    validator: A('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
  },
};
