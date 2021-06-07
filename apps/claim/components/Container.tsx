import { styled } from '@jarvis-network/ui';
import { ReactNode } from 'react';

import { backgroundMap } from '@/data/backgrounds';
import { useReduxSelector } from '@/state/useReduxSelector';

const MainWrapper = styled.div<{ image: string }>`
  min-height: 100vh;
  color: ${props => props.theme.text.primary};
  display: flex;
  flex-direction: column;
  background: url(${props => props.image}) no-repeat;
  background-color: ${props => props.theme.background.medium};
  background-size: cover;
  height: 100%;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    flex-direction: column-reverse;
  }
`;

export function Container({ children }: { children: ReactNode }): JSX.Element {
  const theme = useReduxSelector(state => state.theme);
  return <MainWrapper image={backgroundMap[theme]}>{children}</MainWrapper>;
}
