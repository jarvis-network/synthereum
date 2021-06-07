import { Tabs, styled } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';
import { Claim } from '@/components/Claim';
import { History } from '@/components/History';

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

export default function Home(): JSX.Element {
  const auth = useReduxSelector(state => state.auth);

  return (
    <Container>
      <Content>
        <Title>Claim Your JRT Tokens</Title>
        {auth ? (
          <CustomTabs
            pointer={false}
            tabs={[
              { title: 'Claim', content: <Claim /> },
              { title: 'History', content: <History /> },
            ]}
          />
        ) : (
          <div>Log in first</div>
        )}
      </Content>
    </Container>
  );
}
