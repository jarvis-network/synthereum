import { styled } from '@jarvis-network/ui';

import { UserHeader } from './UserHeader';

const Outer = styled.div`
  background-color: ${props => props.theme.background.primary};
  border-top: 1px solid ${props => props.theme.border.secondary};
  position: fixed;
  bottom: 0;
  width: 100%;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    border: 0 none;
    top: 0;
    bottom: auto;
  }
`;

const Inner = styled.div`
  max-width: 900px;
  margin: 0 auto;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
`;

export function Header(): JSX.Element {
  return (
    <Outer>
      <Inner>
        <img src="/images/logo.svg" alt="Jarvis Logo" height="30" width="30" />
        <UserHeader />
      </Inner>
    </Outer>
  );
}
