import { Market } from './markets';

export const sortAssetArray = (assets: Market[]) =>
  assets.sort((a, b) => {
    const [assetA, collateralA] = a.pair!.replace('j', '').split('/');
    const [assetB, collateralB] = b.pair!.replace('j', '').split('/');
    const compareCollateral = collateralA.localeCompare(collateralB);
    return compareCollateral === 0
      ? assetA.localeCompare(assetB)
      : compareCollateral;
  });
