import React, { useEffect, useState } from 'react';
import {
  Amount,
  Asset,
  AssetSelect,
  Balance,
  ErrorMessage,
  ExchangeBox,
  Form,
  handleKeyPress,
  Link,
  Max,
  SubmitButton,
  SubmitContainer,
  Value,
} from '@/components/markets/modal/common';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';
import { SupportedSelfMintingPairExact } from '@jarvis-network/synthereum-config';
import _ from 'lodash';
import { selfMintingMarketAssets } from '@/data/markets';
import { useReduxSelector } from '@/state/useReduxSelector';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { formatUSDValue } from '@jarvis-network/synthereum-ts/dist/core/realms/self-minting/common';

const title = 'Lorem ipsum withdraw';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);
interface WithdrawProps {
  assetKey: SupportedSelfMintingPairExact;
}
export const Withdraw: React.FC<WithdrawProps> = ({ assetKey }) => {
  const [collateralValue, setCollateralValue] = useState('');
  const [slow, setSlow] = useState(false);
  let assetInValue = '0.00';
  const assetDetails = useReduxSelector(state => state.markets.list[assetKey]);

  const selectedAsset = selfMintingMarketAssets[assetKey];
  const balance = FPN.fromWei(
    assetDetails!.positionCollateral!,
    // '1000000000000000000000'
  );
  const assetInPrice = useReduxSelector(
    state => state.prices[selectedAsset.assetIn.name],
  );

  const assetOutPrice = useReduxSelector(
    state => state.prices[selectedAsset.pair],
  );
  const onMaxSelect = () => setCollateralValue(balance.format(2));

  const insufficientFunds = balance.lt(
    new FPN(collateralValue === '' ? '0' : collateralValue),
  )!;
  if (assetInPrice && collateralValue !== '') {
    assetInValue = formatUSDValue(assetInPrice, collateralValue);
  }
  const errorMessage = insufficientFunds ? 'Insufficient funds' : null;

  useEffect(() => {
    if (collateralValue !== '') {
      const inputCollateral = FPN.toWei(collateralValue.toString());

      const newRatio = FPN.fromWei(assetDetails!.positionCollateral!)
        .sub(inputCollateral)
        .div(FPN.fromWei(assetDetails!.positionTokens!));

      setSlow(newRatio.lt(FPN.fromWei(assetDetails!.collateralizationRatio!)));
      console.log({
        aa: 'tt',
        dd: FPN.fromWei(assetDetails!.collateralRequirement!).toString(),
        d1: newRatio
          .mul(FPN.fromWei(assetOutPrice!.toString()))

          .toString(),
        lt: FPN.fromWei(assetDetails!.collateralRequirement!).lt(
          newRatio.mul(FPN.fromWei(assetOutPrice!.toString())),
        ),
        gcr: assetDetails?.collateralizationRatio!.toString(),
        nro: newRatio.toString(),
        slow,
      });
    }
  }, [collateralValue]);

  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="withdraw">
      <Form>
        <ExchangeBox error={Boolean(errorMessage)}>
          <Balance>Balance: {balance.format(4)}</Balance>
          <AssetSelect error={insufficientFunds}>
            <Amount
              value={collateralValue}
              inputMode="numeric"
              onKeyPress={e => handleKeyPress(e, { decimals: 5 })}
              required
              onChange={e => {
                setCollateralValue(e.target.value);
              }}
              onFocus={e => {
                e.target.select();
              }}
            />
            <Max onClick={onMaxSelect} />
            <Asset
              flag={selectedAsset.assetIn.icon}
              name={selectedAsset.assetIn.name}
            />
          </AssetSelect>
          <ErrorMessage>{errorMessage}</ErrorMessage>
        </ExchangeBox>
        <Value>Value: ${assetInValue}</Value>
      </Form>
      <SubmitContainer>
        <SubmitButton>Withdraw</SubmitButton>
      </SubmitContainer>
    </WithPlaceholder>
  );
};
