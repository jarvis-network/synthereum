import React from 'react';

import { flexRow } from '../common/mixins';
import { Icon } from '../Icon';
import { styled } from '../Theme';
import { Asset } from '../AssetsRow/Asset';
import { AssetsRowProps } from '../AssetsRow/types';

const Container = styled.div`
  ${flexRow()}
  justify-content: space-between;
  padding: 12px 24px;
  cursor: pointer;
`;

const ItemContainer = styled.div<{ width: string }>`
  width: ${props => props.width};
`;

const IconContainer = styled(ItemContainer)`
  ${flexRow()}
  font-size: ${props => props.theme.font.sizes.xl};
  align-items: center;
  justify-content: center;
`;

const EndIconContainer = styled(IconContainer)`
  justify-content: flex-end;
`;

export const AssetsRow: React.FC<AssetsRowProps> = ({ from, to, isOpen }) => (
  <Container>
    <ItemContainer width="40%">
      <Asset {...from} />
    </ItemContainer>
    <IconContainer width="14%">
      <Icon icon="IoIosArrowRoundForward" />
    </IconContainer>
    <ItemContainer width="36%">
      <Asset {...to} />
    </ItemContainer>
    <EndIconContainer width="10%">
      <Icon icon={isOpen ? 'IoIosArrowDown' : 'IoIosArrowForward'} />
    </EndIconContainer>
  </Container>
);
