import React from 'react';
import { Flag, FlagKeys, styled } from '@jarvis-network/ui';

type AssetFlag = FlagKeys | null;

interface Props {
  assets: [AssetFlag, AssetFlag];
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

  .item-0 {
    top: 0;
    left: 0;
    z-index: 2;
  }

  .item-1 {
    bottom: 0;
    right: 0;
    z-index: 1;
  }
`;

export const FlagsPair: React.FC<Props> = ({ assets }) => (
  <Container>
    {assets.map((icon, index) =>
      icon ? <Flag flag={icon} className={`item-${index}`} key={icon} /> : null,
    )}
  </Container>
);
