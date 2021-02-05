import { Roles, PerNetwork } from '..';
import { assertIsAddress as A } from '@jarvis-network/web3-utils/eth/address';
import { typeCheck } from '@jarvis-network/web3-utils/base/meta';

export const roles = typeCheck<PerNetwork<Roles>>()({
  '42': {
    admin: A('0x81ccE2d050dEfB2d8F79946e4D0714c170cDe410'),
    maintainer: A('0x8B4AC947A5866693cB9AB930E72E0546ABe04679'),
    liquidityProvider: A('0xCc3528125499d168ADFB5Ef99895c98a7C430ed4'),
    validator: A('0x61b5A06CE0FcdA6445fb454244Ce84ED64c41aCa'),
  },
  '1': {
    admin: A('0x128C8E20Dd4F2d8519dD605632660686bA35D212'),
    maintainer: A('0x10D7C10A2F25bA6212968d8918eb687d589C6e0a'),
    liquidityProvider: A('0xc31249BA48763dF46388BA5C4E7565d62ed4801C'),
    validator: A('0xCb3508A63176c8a2D24f1d048374E80BEfe8A8a2'),
  },
} as const); // Mark as const so TS can know what networks are actually defined
