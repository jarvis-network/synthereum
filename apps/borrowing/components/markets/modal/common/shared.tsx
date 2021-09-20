import { styled } from '@jarvis-network/ui';

import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config/dist';
import React from 'react';

import { Link } from '.';

export const ErrorMessageContainer = styled.div`
  text-align: center;
  display: block;
  background: #ff7777;
  color: #fff;
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 5px;
  font-weight: 600;
`;

export const Footer = styled.div`
  background: rgb(255, 255, 255);
  color: rgb(0, 0, 0);
  border-radius: 20px;
  height: 145px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  position: absolute;
  bottom: -175px;
  left: 0px;
  padding: 10px 0px;
  > div {
    border-bottom: 1px solid ${props => props.theme.border.primary};
    display: flex;
    padding: 10px 20px;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-content: center;
    align-items: center;
    > div {
      flex: 0 1 auto;
    }
  }
  > div:last-child {
    border-bottom: 0px !important;
  }
`;

export const title = 'Lorem ipsum borrow';
export const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
export interface ActionProps {
  assetKey: SupportedSelfMintingPairExact;
  tabHandler?: (input: number) => void;
}
