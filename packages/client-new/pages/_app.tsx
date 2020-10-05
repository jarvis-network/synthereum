import type { AppProps /*, AppContext */ } from 'next/app'
import { Provider as StateProvider } from 'react-redux'

import {useStore} from "state/store";
import AppThemeProvider from "components/AppThemeProvider";

function MyApp({ Component, pageProps }: AppProps) {
  const store = useStore(pageProps.initialReduxState)

  return (
    <StateProvider store={store}>
      <AppThemeProvider>
        <Component {...pageProps} />
      </AppThemeProvider>
    </StateProvider>
  )
}

export default MyApp
