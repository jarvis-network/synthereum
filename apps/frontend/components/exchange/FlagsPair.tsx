import React from 'react';
import { Flag, styled } from '@jarvis-network/ui';
import { AssetPair } from '@/data/assets';

interface Props {
  assetPair: AssetPair;
}

const Container = styled.div`
  position: relative;
  width: 36px;
  height: 22px;

  img {
    width: 22px;
    height: 22px;
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
