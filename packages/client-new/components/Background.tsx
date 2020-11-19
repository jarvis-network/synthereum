import { styled } from '@jarvis-network/ui';
import { themeValue } from '@/utils/themeValue';

export const Background = styled.div<{ image: string }>`
  height: 100%;
  background-repeat: no-repeat;
  background-color: ${themeValue(
    { light: theme => theme.border.secondary },
    theme => theme.background.primary,
  )};
  background-size: cover;
  background-image: url(${props => props.image});

  @media (min-width: 721px) {
    background-position: center 118px;
  }
`;
