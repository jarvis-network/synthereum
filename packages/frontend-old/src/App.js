import React, { useEffect, useState } from 'react';
import { useWeb3Context } from 'web3-react';

import { makeStyles } from '@material-ui/core/styles';
import Backdrop from '@material-ui/core/Backdrop';
import CircularProgress from '@material-ui/core/CircularProgress';
import Container from '@material-ui/core/Container';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';

import Wallet from './components/layout/Wallet';

import { BrowserRouter as Router } from 'react-router-dom';

const useStyles = makeStyles(theme => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
  wallet: {
    marginTop: theme.spacing(4),
  },
  fullscreen: {
    height: '100vh',
    backgroundColor: '#f7fbfb',
  },
}));

export default function App() {
  const classes = useStyles();

  const context = useWeb3Context();

  const [loading, setLoading] = useState(true);

  const actualDate = new Date();

  const actualDay = actualDate.getUTCDay();

  const actualHour = actualDate.getUTCHours();

  useEffect(() => {
    if (!context.active) {
      context.setFirstValidConnector(['MetaMask', 'Infura']);
    }
  }, [context]);

  useEffect(() => {
    if (context.active) {
      setLoading(false);
    }
  }, [context.active]);

  if (!context.active && !context.error) {
    return (
      <Backdrop open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  } else if (context.error) {
    return <div>Error</div>;
  } else if (context.networkId !== 42) {
    return (
      <div className="App">
        <Container maxWidth="md">
          <Grid className={classes.fullscreen} container alignItems="center">
            <Grid item xs={12}>
              <Typography variant="h6" align="center">
                Jarvis Synthetic Tokens are only available on the Kovan network.
              </Typography>
              <Typography variant="subtitle1" align="center">
                Please switch MetaMask to the Kovan network.
              </Typography>
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  } else {
    return (
      <div className={classes.app}>
        <Backdrop className={classes.backdrop} open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Router>
          <Wallet setLoading={setLoading} />
        </Router>
        <div>
          {(actualDay === 5 && actualHour > 22) ||
          actualDay === 6 ||
          (actualDay === 0 && actualHour < 22) ? (
            <Typography variant="h4" align="center" color="error">
              Market is closed
            </Typography>
          ) : null}
        </div>
      </div>
    );
  }
}
