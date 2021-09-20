import React from 'react';

import { FlagKeys } from '@jarvis-network/ui';

import { AssetSelect, Asset } from '../common';

import { ValueBox } from './style';

export interface PreviewParamsRow {
  title: string;
  asset: {
    name: string;
    icon: FlagKeys;
  };
  value: string;
}

export interface TransactionParamsProps {
  params: PreviewParamsRow[];
}

export const TransactionParams = ({ params }: TransactionParamsProps) => (
  <div>
    {params.map(param => (
      <div key={param.title.toLowerCase()}>
        <AssetSelect error={false}>
          <div>{param.title}</div>
          <ValueBox>
            <div>{param.value}</div>
            <Asset flag={param.asset.icon} name={param.asset.name} />
          </ValueBox>
        </AssetSelect>
      </div>
    ))}
  </div>
);
