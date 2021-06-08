import { styled, ThemeProvider } from '@jarvis-network/ui';
import { Global, css } from '@emotion/core';

const Container = styled.div`
  background-image: url('/images/under-maintenance-jarvis.png');
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;

  @media (min-aspect-ratio: 11/5) {
    background-size: contain;
  }
`;

const Pusher = styled.div`
  display: flex;
  justify-content: center;
  padding-top: 10vh;
  box-sizing: border-box;
  flex-basis: 80vh;
`;

const Message = styled.h1`
  text-align: center;
  margin: 0 5%;
`;

export function TechnicalMaintenance(): JSX.Element | null {
  return (
    <ThemeProvider>
      <Container>
        <Global
          styles={css`
            body,
            html {
              padding: 0;
              margin: 0;
            }
          `}
        />
        <Pusher>
          <img
            src="/images/logo.svg"
            alt="Jarvis Logo"
            width="50"
            height="50"
          />
        </Pusher>
        <Message>Technical maintenance</Message>
      </Container>
    </ThemeProvider>
  );
}
