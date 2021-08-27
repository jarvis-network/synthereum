import React, { FC, useState } from 'react';
import { styled } from '@jarvis-network/ui';

import { FlagsPair } from '@/components/FlagsPair';
import { Market } from '@/state/slices/markets';
import { selfMintingMarketAssets } from '@/data/markets';
import { motion } from 'framer-motion';

import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';

import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import { useReduxSelector } from '@/state/useReduxSelector';

const Container = styled.div`
  background: ${props => props.theme.background.primary};
  box-shadow: ${props => props.theme.shadow.base};
  border-radius: 20px;
  width: 280px;
  height: 470px;
  position: relative;
`;

const Header = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${props => props.theme.sizes.row};
  font-size: ${props => props.theme.font.sizes.l};
  font-weight: 500;

  > * {
    margin: 0 10px;
  }
`;

const Footer = styled.div`
  height: ${props => props.theme.sizes.row};
  padding: 0 20px;
  position: absolute;
  bottom: 20px;
  left: 0;
  right: 0;
`;

const DataList = styled.div``;

const DataListItem = styled.div<{ label: string }>`
  border-bottom: 1px solid ${props => props.theme.border.primary};
  height: ${props => props.theme.sizes.row};
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:before {
    content: '${props => props.label}';
    color: ${props => props.theme.text.medium};
  }

  &:first-child {
    border-top: 1px solid ${props => props.theme.border.primary};
  }
`;

const tapAnimation = {
  tap: {
    scale: 0.85,
  },
};

const ButtonBg = {
  hover: {
    scale: 30,
    transition: {
      duration: 0.2,
    },
  },
  closed: {
    scale: 0,
    transition: {
      duration: 0.2,
    },
  },
};
export const ButtonWrapper = styled.div`
  width: 100%;
`;

export const ManageButton = styled(motion.button)`
  position: relative;
  overflow: hidden;
  background: ${props => props.theme.background.inverted};
  display: block;
  width: 100%;
  height: ${props => props.theme.sizes.row};
  border-radius: ${props => props.theme.borderRadius.s};
  outline: none;
  border: 0px;
  cursor: pointer;
`;
export const BgCircle = styled(motion.div)`
  position: absolute;
  left: calc(50% - 5px);
  top: calc(50% - 5px);
  width: 10px;
  height: 10px;
  border-radius: 50px;
  // background: ${props => props.theme.background.secondary};
  background: #0e0e0e;
  margin: 0;
`;
export const ButtonContent = styled.div`
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.theme.text.inverted};
  text-align: center;
  text-transform: uppercase;
  font-size: ${props => props.theme.font.sizes.l};
`;
export const ButtonLabel = styled.div`
  z-index: 0;
`;
type MarketCardInfo = Pick<
  Market,
  | 'pair'
  | 'collateralizationRatio'
  | 'liquidationRatio'
  | 'positionCollateral'
  | 'positionTokens'
  | 'price'
>;
type MarketCardProps = MarketCardInfo & {
  onManageClick: () => void;
};
export const MarketCard: FC<MarketCardProps> = ({
  pair,
  collateralizationRatio,
  positionCollateral,
  positionTokens,
  price,
  liquidationRatio,
  onManageClick,
}) => {
  const p = pair as SupportedSelfMintingPairExact;
  const { assetOut, assetIn } = selfMintingMarketAssets[p];
  const [buttonState, setButtonState] = useState<string>('closed');
  const auth = useReduxSelector(state => state.auth);

  return (
    <Container>
      <Header>
        <FlagsPair assets={[assetOut.icon, assetIn.icon]} /> {assetOut.name}-
        {assetIn.name}
      </Header>

      <DataList>
        <DataListItem label="Collateralization">
          {FPN.fromWei(collateralizationRatio!)
            .div(FPN.fromWei(price!))
            .mul(FPN.toWei('100'))
            .format(2)}
          %
        </DataListItem>

        <DataListItem label="Liquidation Ratio">
          {FPN.fromWei(liquidationRatio!).mul(FPN.toWei('100')).format(2)}%
        </DataListItem>

        {auth && positionCollateral && positionCollateral.toString() !== '0' ? (
          <DataListItem label="User Collateralization">
            {FPN.fromWei(positionCollateral!)
              .div(FPN.fromWei(positionTokens!))
              .div(FPN.fromWei(price!))
              .mul(FPN.toWei('100'))
              .format(2)}
          </DataListItem>
        ) : null}

        {auth && positionCollateral && positionCollateral.toString() !== '0' ? (
          <DataListItem label="Collateral Deposited">
            {FPN.fromWei(positionCollateral!).format(2)}
          </DataListItem>
        ) : null}

        {auth && positionTokens && positionTokens.toString() !== '0' ? (
          <DataListItem label={`${assetOut.name} minted`}>
            {FPN.fromWei(positionTokens!).format(2)}
          </DataListItem>
        ) : null}
      </DataList>

      {onManageClick && (
        <Footer>
          {collateralizationRatio?.toString() !== '0' ? (
            <ButtonWrapper onClick={onManageClick}>
              <motion.div
                whileTap="tap"
                variants={tapAnimation}
                onMouseEnter={() => setButtonState('hover')}
                onMouseLeave={() => setButtonState('closed')}
              >
                <ManageButton animate={buttonState}>
                  <BgCircle
                    initial={{ scale: 0 }}
                    animate={buttonState}
                    variants={ButtonBg}
                    className="bg-gray-600"
                  />
                  <ButtonContent>
                    <ButtonLabel>Manage</ButtonLabel>
                  </ButtonContent>
                </ManageButton>
              </motion.div>
            </ButtonWrapper>
          ) : (
            <ButtonWrapper>
              <motion.div
                whileTap="tap"
                variants={tapAnimation}
                onMouseEnter={() => setButtonState('hover')}
                onMouseLeave={() => setButtonState('closed')}
              >
                <ManageButton animate={buttonState}>
                  <BgCircle
                    initial={{ scale: 0 }}
                    animate={buttonState}
                    variants={ButtonBg}
                    className="bg-gray-600"
                  />
                  <ButtonContent>
                    <ButtonLabel>---</ButtonLabel>
                  </ButtonContent>
                </ManageButton>
              </motion.div>
            </ButtonWrapper>
          )}
        </Footer>
      )}
    </Container>
  );
};
