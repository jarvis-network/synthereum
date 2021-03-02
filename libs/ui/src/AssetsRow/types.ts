import { ReactNode } from 'react';

import { FlagKeys } from '../Flag';

export interface AssetProps {
  name: string;
  flag?: FlagKeys;
  image?: string;
  value?: number | string;
}

export interface AssetsRowProps {
  isOpen?: boolean;
  from: AssetProps;
  to: AssetProps;
}

export interface AssetsRowExpandProps extends Omit<AssetsRowProps, 'isOpen'> {
  descriptions: {
    label: string | ReactNode;
    value: string | ReactNode;
    tooltip?: string;
  }[];
}
