import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { makeStyles } from "@material-ui/core/styles";


import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";

import * as icons from "../src/assets/icons";

const useStyles = makeStyles(theme => ({
  TableCell: {
    display: 'flex',
    alignItems: 'center'
  },
  TokenIcon: {
    marginRight: 10,
    width: 24,
    height: 24
  }
}));

export default function WalletBalance({ className, assets, syntheticTokens, token, dai, lastTx }) {

  const classes = useStyles();

  const context = useWeb3Context();

  const [synBalance, setSynBalance] = useState("0");
  const [balance, setBalance] = useState("0");

  const { fromWei } = context.library.utils;

  useEffect(() => {
    if (context.active && syntheticTokens[token]) {
      syntheticTokens[token].methods.balanceOf(context.account).call()
        .then(synBalance => {
          setSynBalance(synBalance)
        });
    }
  }, [context, context.active, syntheticTokens, token, lastTx]);

  useEffect(() => {
    if (context.active && dai) {
      dai.methods.balanceOf(context.account).call().then(balance => setBalance(balance));
    }
  }, [context, context.active, dai, lastTx]);

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Wallet Balance
      </Typography>
      <TableContainer component={Paper} className={className}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {
              assets.map((asset, index) => (
                <TableRow key={index}>
                  <TableCell className={classes.TableCell}>
                    <img className={classes.TokenIcon} alt={asset.symbol} src={icons[asset.symbol]} />
                    {asset.symbol}
                  </TableCell>
                  <TableCell align="right">
                    {Number(fromWei(synBalance, "ether")).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))
            }
          {/* <TableRow>
            <TableCell>{assets[token].symbol}</TableCell>
            <TableCell align="right">
              {Number(fromWei(synBalance, "ether")).toLocaleString()}
            </TableCell>
          </TableRow> */}
            <TableRow>
              <TableCell className={classes.TableCell}>
                <img className={classes.TokenIcon} alt="DAI" src={icons.DAI}/>
                DAI
              </TableCell>
              <TableCell align="right">
                {Number(fromWei(balance, "ether")).toLocaleString()}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
