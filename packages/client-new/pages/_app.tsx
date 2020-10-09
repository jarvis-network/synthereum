import type { AppProps /*, AppContext */ } from 'next/app'
import { Provider as StateProvider } from 'react-redux'

import { styled } from "@jarvis-network/ui";

import {useStore} from "state/store";
import AppThemeProvider from "components/AppThemeProvider";
import PreloadBackground from "components/PreloadBackground";

import "./_app.css";

const MainWrapper = styled.div`
  height: 100vh;
  width: 100vw;
  background: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
`

function MyApp({ Component, pageProps }: AppProps) {
  const store = useStore(pageProps.initialReduxState)

  return (
    <StateProvider store={store}>
      <AppThemeProvider>
        <MainWrapper>
          <PreloadBackground>
            <Component {...pageProps} />
          </PreloadBackground>
        </MainWrapper>
      </AppThemeProvider>
    </StateProvider>
  )
}

export default MyApp
