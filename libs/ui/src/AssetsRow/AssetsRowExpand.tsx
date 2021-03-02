import React, { useState } from 'react';

import { styled } from '../Theme';
import { AssetsRow } from '../AssetsRow';
import { AssetsRowExpandProps } from '../AssetsRow/types';
import { Dropdown } from '../Dropdown';
import { Descriptions, DescriptionsItemTooltip } from '../Descriptions';

const ExpandContent = styled.div`
  width: 100%;
  background: ${props => props.theme.background.medium};
  padding: 10px 5px;
  font-size: ${props => props.theme.font.sizes.m};
`;

export const AssetsRowExpand: React.FC<AssetsRowExpandProps> = ({
  from,
  to,
  descriptions,
}) => {
  const [isExpanded, setExpanded] = useState(false);

  return (
    <Dropdown
      width="100%"
      header={<AssetsRow from={from} to={to} isOpen={isExpanded} />}
      blockOutsideCollapse
      isExpanded={isExpanded}
      setExpanded={setExpanded}
      useBoxShadow={false}
      useBorder
    >
      <ExpandContent>
        <Descriptions isGrid>
          {descriptions.map((item, index) => (
            <DescriptionsItemTooltip
              label={item.label}
              isGrid
              valueTooltip={item.tooltip || null}
            >
              {item.value}
            </DescriptionsItemTooltip>
          ))}
        </Descriptions>
      </ExpandContent>
    </Dropdown>
  );
};
