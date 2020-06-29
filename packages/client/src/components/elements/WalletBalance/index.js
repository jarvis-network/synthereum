import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import Box from "@material-ui/core/Box";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";

import * as icons from "../../../assets/icons";

import useStyles from "./styles";
import CollateralBar from "../CollateralBar";

export default function WalletBalance({
  assets,
  syntheticTokens,
  token,
  dai,
  lastTx
}) {
  const classes = useStyles();

  const context = useWeb3Context();

  const [synBalance, setSynBalance] = useState("0");
  const [balance, setBalance] = useState("0");

  const { fromWei } = context.library.utils;

  useEffect(() => {
    if (context.active && syntheticTokens[token]) {
      syntheticTokens[token].methods
        .balanceOf(context.account)
        .call()
        .then(synBalance => {
          setSynBalance(synBalance);
        });
    }
  }, [context, context.active, syntheticTokens, token, lastTx]);

  useEffect(() => {
    if (context.active && dai) {
      dai.methods
        .balanceOf(context.account)
        .call()
        .then(balance => setBalance(balance));
    }
  }, [context, context.active, dai, lastTx]);

  return (
    <Paper className={classes.Paper}>
      <Grid container>
        <Grid item xs={6}>
          <Typography variant="h6">Token</Typography>
        </Grid>
        <Grid item xs={6} align="right">
          <Typography variant="h6">Balance</Typography>
        </Grid>
      </Grid>

      {assets.map((asset, index) => (
        <Grid container className={classes.SynthToken}>
          <Grid item xs={6}>
            <Box
              className={classes.TokenCell}
              display="flex"
              alignItems="center"
            >
              <img
                className={classes.TokenIcon}
                alt={asset.symbol}
                src={icons[asset.symbol]}
              />
              {asset.symbol}
            </Box>
          </Grid>
          <Grid item xs={6} align="right">
            {Number(fromWei(synBalance, "ether")).toLocaleString()}
          </Grid>
          <Grid item xs={12}>
            <CollateralBar />
          </Grid>
        </Grid>
      ))}

      <Grid container className={classes.TokenInfo}>
        <Grid item xs={6}>
          <Box className={classes.TokenCell} display="flex" alignItems="center">
            <img className={classes.TokenIcon} alt="DAI" src={icons.DAI} />
            DAI
          </Box>
        </Grid>
        <Grid item xs={6} align="right">
          {Number(fromWei(balance, "ether")).toLocaleString()}
        </Grid>
      </Grid>
    </Paper>
  );
}
