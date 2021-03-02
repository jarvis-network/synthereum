import React from 'react';

import { styled } from '../Theme';
import { Tooltip } from '../Tooltip';
import { Icon } from '../Icon';
import { flexRow } from '../common/mixins';

import { DescriptionsItemTooltipProps } from './types';
import { DescriptionsItem } from './DescriptionsItem';

const IconContainer = styled(Icon)`
  font-size: ${props => props.theme.font.sizes.l};
  color: ${props => props.theme.common.primary};
`;

const TooltipSpanContainer = styled.span`
  ${flexRow()}
`;

const CustomTooltip = ({
  tooltip,
  children,
}: Pick<DescriptionsItemTooltipProps, 'tooltip' | 'children'>) => (
  <Tooltip tooltip={tooltip} position="right" width="250px">
    <TooltipSpanContainer>
      {children}
      <IconContainer icon="IoIosHelpCircleOutline" style={{ marginLeft: 4 }} />
    </TooltipSpanContainer>
  </Tooltip>
);

export const DescriptionsItemTooltip: React.FC<DescriptionsItemTooltipProps> = ({
  label,
  children,
  isGrid = false,
  tooltip = null,
  valueTooltip = null,
}) => (
  <DescriptionsItem
    isGrid={isGrid}
    label={
      tooltip ? <CustomTooltip tooltip={tooltip}>{label}</CustomTooltip> : label
    }
  >
    {valueTooltip ? (
      <CustomTooltip tooltip={valueTooltip}>{children}</CustomTooltip>
    ) : (
      children
    )}
  </DescriptionsItem>
);
