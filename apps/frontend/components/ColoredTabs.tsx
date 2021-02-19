import { styled, Tabs, themeValue } from '@jarvis-network/ui';

export const ColoredTabs = styled(Tabs)`
  height: 100%;

  > :first-child {
    background: ${themeValue(
      {
        dark: '#252525',
        night: '#212a34',
      },
      theme => theme.border.secondary,
    )};

    border-bottom-color: ${themeValue(
      {
        light: theme => theme.border.primary,
      },
      theme => theme.border.secondary,
    )};
  }

  [role='button'] > div:nth-child(2) {
    z-index: 2;
  }

  > div:nth-child(2) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: calc(100% - ${props => props.theme.sizes.row});
  }

  @media screen and (max-width: ${props =>
    props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    border-radius: 0 !important;

    > :first-child {
      border-radius: 0 !important;
    }
  }
`;
