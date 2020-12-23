import { styled, themeValue } from '@jarvis-network/ui';

export const Background = styled.div<{ image: string }>`
  height: 100%;
  background-repeat: no-repeat;
  background-color: ${themeValue(
    { light: theme => theme.border.secondary },
    theme => theme.background.primary,
  )};
  background-size: cover;
  background-image: url(${props => props.image});

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex] + 1}px) {
    background-position: center 118px;
  }
`;
