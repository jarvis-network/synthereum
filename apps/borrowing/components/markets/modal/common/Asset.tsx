import React from 'react';
import { Flag, styled } from '@jarvis-network/ui';

const Container = styled.div`
  grid-area: asset;
  justify-self: end;
  margin-top: 5px;
  font-size: ${props => props.theme.font.sizes.m};

  img {
    width: 22px;
    height: 22px;
    object-fit: contain;
    vertical-align: middle;
  }

  i svg {
    width: 11px;
    height: 11px;
  }

  .assetName {
    display: inline-flex;
    justify-content: space-between;
    vertical-align: middle;
    margin-left: 8px;
    font-size: ${props => props.theme.font.sizes.l};
    font-family: Krub;
    font-weight: 300;
  }
`;

const AssetChangeButton = styled.button`
  border: none;
  padding: 0;
  display: inline-block;
  background: none;
  cursor: pointer;
  outline: none !important;
  color: ${props => props.theme.text.primary};
`;

export interface AssetProps {
  name: string;
}

export const Asset: React.FC<AssetProps> = ({ name }) => {
  const flag = <Flag flag={name} />;

  return (
    <Container>
      <AssetChangeButton>
        {flag}
        <div className="assetName">{name}</div>
      </AssetChangeButton>
    </Container>
  );
};
