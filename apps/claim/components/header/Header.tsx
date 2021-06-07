import { styled } from '@jarvis-network/ui';

import { UserHeader } from './UserHeader';

const Outer = styled.div`
  background-color: ${props => props.theme.background.primary};
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
