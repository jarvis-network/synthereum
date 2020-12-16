import React, { useEffect, useState } from 'react';
import { useWeb3React } from '@web3-react/core';
import Typography from '@material-ui/core/Typography';
import useStyles from './styles';

import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';

async function postData(url = '', data = {}) {
  const response = await fetch(url, {
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors',
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *client
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
  if (!response.ok) {
    const error = await response.json();
    const errorNumber = response.status;
    throw new Error('Error ' + errorNumber + ': ' + error);
  } else {
    return await response.json(); // parses JSON response into native JavaScript objects
  }
}

export default function Faucet() {
  const classes = useStyles();

  const context = useWeb3React();

  const [status, setStatus] = useState('redeemed');

  useEffect(
    (pollingInterval = 2000) => {
      async function getStatus() {
        const statusResponse = await postData(
          process.env.REACT_APP_FAUCET_URL + '/getStatus',
          { address: context.account },
        );
        setStatus(statusResponse.status);
      }
      const polling = setInterval(
        async () => await getStatus(),
        pollingInterval,
      );
      return () => {
        clearInterval(polling);
      };
    },
    [context],
  );

  let button;

  if (status == 'redeemable') {
    button = (
      <Button
        className={classes.RedeemButton}
        fullWidth
        margin="normal"
        onClick={async () => {
          const faucetSignature = await context.library.eth.personal.sign(
            'Jarvis Synthereum Faucet Request',
            context.account,
          );
          await postData(process.env.REACT_APP_FAUCET_URL + '/faucetRequest', {
            address: context.account,
            signature: faucetSignature,
          });
        }}
      >
        Redeem
      </Button>
    );
  } else if (status == 'redeeming') {
    button = (
      <Button className={classes.RedeemingButton} fullWidth margin="normal">
        Redeeming ...
      </Button>
    );
  } else {
    button = (
      <Button
        className={classes.RedeemDisabledButton}
        disabled
        fullWidth
        margin="normal"
      >
        Redeem
      </Button>
    );
  }

  return (
    <Paper className={classes.Paper}>
      <form>
        <Grid container justify="center" style={{ minHeight: '35vh' }}>
          <Grid item md={8} className={classes.FormGroup}>
            <Typography variant="h6">
              Hey there and welcome to Jarvis Exchange, our proprietary UI to
              interact with Synthereum!
            </Typography>
            <br />
            <Typography variant="h6">
              In order to showcase the potential of our protocol we invite you
              to test it in demo. To do so you will need some USDC and ETH on
              test net environment, which are called kovan USDC and kovan ETH.
              So before you can play a bit with the awesome features that this
              protocol offers make sure to Redeem some kUSDC and kETH by
              clicking the button below.
            </Typography>
            <br />
            <Typography variant="h6">
              If you already have some in your wallet, you can directly go to
              Exchange page and start buying and selling.
            </Typography>
          </Grid>
        </Grid>
        <Grid container justify="center">
          <Grid item md={4}>
            {button}
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}
