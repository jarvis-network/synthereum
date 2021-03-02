import React, { FC } from 'react';

import { flexColumn, flexRow } from '../common/mixins';
import { styled } from '../Theme';
import { Flag as __Flag } from '../Flag';

import { AssetProps } from './types';

const Container = styled.div`
  ${flexRow()}
  height: 100%;
`;

const Img = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 20px;
`;

const Flag = styled(__Flag)`
  width: 40px;
  height: 40px;
  margin-right: 20px;
`;

const Details = styled.div`
  ${flexColumn()}
  justify-content: space-around;
`;

const Name = styled.span`
  color: ${props => props.theme.text.primary};
  font-size: ${props => props.theme.font.sizes.l};
`;

const Value = styled.span<{ value: number | string }>`
  color: ${props =>
    props.value >= 0 ? props.theme.common.primary : props.theme.common.danger};
  font-size: ${props => props.theme.font.sizes.s};

  ${props =>
    props.value > 0
      ? `
    :before {
      content: '+';
    }
  `
      : ''}
`;

const Image: FC<Pick<AssetProps, 'image' | 'flag'>> = ({ image, flag }) => {
  if (flag) {
    return <Flag flag={flag} />;
  }

  if (image) {
    return <Img src={image} />;
  }

  return null;
};

export const Asset: React.FC<AssetProps> = ({ name, image, flag, value }) => (
  <Container>
    <Image {...{ image, flag }} />
    <Details>
      <Name>{name}</Name>
      {(value || !Number(value)) && (
        <Value value={Number(value)}>{value}</Value>
      )}
    </Details>
  </Container>
);
