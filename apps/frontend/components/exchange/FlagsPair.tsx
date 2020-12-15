import React from 'react';
import { Flag, styled } from '@jarvis-network/ui';
import { AssetPair } from '@/data/assets';

interface Props {
  assetPair: AssetPair;
}

const Container = styled.div`
  position: relative;
  width: 28px;
  height: 28px;

  img {
    width: 19px;
    height: 19px;
    position: absolute;
  }

  .first {
    top: 0;
    left: 0;
    z-index: 2;
  }

  .second {
    bottom: 0;
    right: 0;
    z-index: 1;
  }
`;

export const FlagsPair: React.FC<Props> = ({ assetPair }) => {
  const firstFlag = assetPair.input.icon ? (
    <Flag flag={assetPair.input.icon} className="first" />
  ) : null;
  const secondFlag = assetPair.output.icon ? (
    <Flag flag={assetPair.output.icon} className="second" />
  ) : null;

  return (
    <Container>
      {firstFlag}
      {secondFlag}
    </Container>
  );
};
