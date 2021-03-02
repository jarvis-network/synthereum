import { ReactNode } from 'react';

export interface DescriptionsProps {
  children: ReactNode;
  isGrid?: boolean;
}

export interface DescriptionsItemProps {
  label: string | ReactNode;
  children: string | ReactNode;
  isGrid?: boolean;
}

export interface DescriptionsItemTooltipProps extends DescriptionsItemProps {
  tooltip?: string | ReactNode;
  valueTooltip?: string | ReactNode;
}
