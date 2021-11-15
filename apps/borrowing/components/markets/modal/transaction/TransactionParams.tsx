import React from 'react';

import { AssetSelect, Asset } from '../common';

import { ValueBox } from './style';

export interface PreviewParamsRow {
  title: string;
  asset: {
    name: string;
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
            <Asset name={param.asset.name} />
          </ValueBox>
        </AssetSelect>
      </div>
    ))}
  </div>
);
