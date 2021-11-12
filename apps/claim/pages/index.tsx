import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { Tabs, styled, Button } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { Claim } from '@/components/Claim';
import { History } from '@/components/History';
import { useAuth, useWeb3 } from '@jarvis-network/app-toolkit';
import { setAuthModalVisible } from '@/state/slices/app';
import { useDispatch } from 'react-redux';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    align-items: center;
    justify-content: center;
  }
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${props => props.theme.background.primary};
  flex-grow: 1;

  > div:last-child {
    display: flex;
    flex-direction: column;
    flex-grow: 1;

    > div:first-child {
      height: 50px;
      > div {
        height: 50px;
        line-height: 50px;
        > [role='button'] {
          margin-left: 16px;
        }
      }
    }

    > div:last-child {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }
  }

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    border-radius: 10px;
    overflow: hidden;
    min-width: 500px;
    min-height: 0;
    flex-grow: 0;

    > div:last-child {
      > div:first-child {
        height: 60px;
        > div {
          height: 60px;
          line-height: 60px;
          > [role='button'] {
            margin-left: 24px;
          }
        }
      }
    }
  }
`;

const Title = styled.div`
  height: 74px;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${props => props.theme.background.secondary};
`;

const CustomTabs = styled(Tabs)`
  > div:first-child {
    background-color: transparent;
  }
`;

const SignIn = styled.div`
  display: flex;
  padding: 16px;
  flex-direction: column-reverse !important;

  > button {
    width: 100%;
    text-align: center;
  }

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: calc(275px + 60px);
    padding: 24px;
  }
`;

const SwitchWallet = styled.div`
  display: flex;
  padding: 16px;
  flex-direction: column-reverse !important;

  > button {
    width: 100%;
    text-align: center;
  }

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    height: calc(275px + 60px);
    padding: 24px;
  }
`;

const Spacer = styled.div`
  flex-grow: 1;
`;

const NoAllocatedTokens = styled.div`
  width: 100%;
  text-align: center;
  padding: 16px;
  background-color: rgba(250, 78, 78, 0.15);
  color: ${props => props.theme.common.danger};
  border-radius: 10px;
  flex-grow: 0 !important;
  font-size: 18px;
`;

const Sculpture = styled.img`
  display: block;
  margin: 0 auto;
  margin-bottom: 20px;
`;

export default function Home(): JSX.Element {
  const { claim } = useReduxSelector(state => state);
  const { account: address } = useWeb3();
  const { logout } = useAuth();
  const dispatch = useDispatch();

  function login() {
    dispatch(setAuthModalVisible(true));
  }

  return (
    <Container>
      <Content>
        <Title>Claim Your JRT Tokens</Title>
        {claim && new FPN(claim.investorInfo, true).toNumber() <= 0 ? (
          <SwitchWallet
            onClick={() => {
              logout();
              setTimeout(login, 100);
            }}
          >
            <Button type="success">Switch Wallet</Button>
            <Spacer />
            <NoAllocatedTokens>
              No allocated tokens for this wallet
            </NoAllocatedTokens>
            <Sculpture
              src="/images/girl-sculpture-dark.png"
              height="120"
              alt="No allocated tokens"
            />
          </SwitchWallet>
        ) : address ? (
          <CustomTabs
            pointer={false}
            tabs={[
              { title: 'Claim', content: <Claim /> },
              { title: 'History', content: <History /> },
            ]}
          />
        ) : (
          <SignIn>
            <Button type="success" onClick={login}>
              Sign in
            </Button>
          </SignIn>
        )}
      </Content>
    </Container>
  );
}
