import { styled } from '@jarvis-network/ui';
import { Card } from '@/components/Card';

export const StyledCard = styled(Card)`
  width: 100%;
  height: 100%;

  @media screen and (max-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    width: 100%;
    box-shadow: none;
  }
`;
