import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { makeStyles } from "@material-ui/core/styles";

import Grid from "@material-ui/core/Grid";

import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";

import Container from "@material-ui/core/Container";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";

import * as icons from "../../../assets/icons";
import { borderBottom } from "@material-ui/system";

const useStyles = makeStyles(theme => ({
  AppBar: {
    background: "#bdc3c7"
  },
  Logo: {
    color: "#000000",
    fontFamily: "Rubik"
  },
  Toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  Container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(2),
    backgroundColor: '#ecf0f1'
  },
  Paper: {
    width: 520,
    paddingTop: 0,
    paddingLeft: 40,
    paddingRight: 40,
    border: '1px solid #7f8c8d',
    boxShadow: 'none',
    background: 'transparent'
  },
  TableCell: {
    display: "flex",
    alignItems: "center",
    fontSize: 18,
    fontWeight: 400
  },
  TokenIcon: {
    marginRight: 10,
    width: 24,
    height: 24
  }
}));

export default function WalletBalance({
  className,
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

  console.log(context);

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
    <Grid>
      <Grid item md={12}>
        <AppBar position="static" className={classes.AppBar}>
          <Toolbar className={classes.Toolbar}>
            <Typography variant="h6" className={classes.Logo}>
              Synthereum Wallet
            </Typography>
            <Typography variant="h6" className={classes.Logo}>
              Address
            </Typography>
          </Toolbar>
        </AppBar>
      </Grid>
      <Grid item md={12}>
      <Container className={classes.Container}>
        <Paper className={classes.Paper}>
          <TableContainer className={className}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Token</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {assets.map((asset, index) => (
                  <TableRow key={index}>
                    <TableCell className={classes.TableCell}>
                      <img
                        className={classes.TokenIcon}
                        alt={asset.symbol}
                        src={icons[asset.symbol]}
                      />
                      {asset.symbol}
                    </TableCell>
                    <TableCell align="right">
                      {Number(fromWei(synBalance, "ether")).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className={classes.TableCell}>
                    <img
                      className={classes.TokenIcon}
                      alt="DAI"
                      src={icons.DAI}
                    />
                    DAI
                  </TableCell>
                  <TableCell align="right">
                    {Number(fromWei(balance, "ether")).toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        </Container>
      </Grid>
    </Grid>
  );
}
