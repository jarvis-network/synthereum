import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import Box from "@material-ui/core/Box";
import {
  Card,
  CardHeader,
  CardContent,
  Table,
  TableRow,
  TableBody,
  TableCell
} from "@material-ui/core";
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

  const [synBalances, setSynBalances] = useState(
    Array(syntheticTokens.length).fill("0")
  );
  const [balance, setBalance] = useState("0");

  const { fromWei } = context.library.utils;

  useEffect(() => {
    if (context.active) {
      syntheticTokens.map((token, i) => {
        if (token) {
          token.methods
            .balanceOf(context.account)
            .call()
            .then(synBalance => {
              synBalances[i] = synBalance;
              setSynBalances(synBalances);
            });
        }
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

  console.log(assets);

  return (
    <Card className={classes.Paper}>
      <CardHeader title="Wallet Details" className={classes.CardHeader} />
      <CardContent className={classes.CardContent}>
        <Table>
          <TableBody>
            {assets.map((asset, index) => (
              <TableRow>
                <TableCell className={classes.TokenIconCell}>
                  <img
                    alt={asset.symbol}
                    width="56"
                    height="56"
                    src={icons[asset.symbol]}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="h6" display="block">
                    {asset.symbol}
                  </Typography>
                  <Typography variant="body2">{asset.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography className={classes.BalanceCell}>
                    {Number(
                      fromWei(synBalances[index] || "0", "ether")
                    ).toLocaleString()}
                  </Typography>
                </TableCell>
                {/* <TableCell align="right">
                  <Typography variant="body1" display="block">100/110</Typography>
                  <Typography variant="body2">Your Collateral</Typography>
                </TableCell> */}
                <TableCell align="right">
                  <CollateralBar />
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <img alt="DAI" width="56" height="56" src={icons.DAI} />
              </TableCell>
              <TableCell className={classes.TokenCell}>DAI</TableCell>
              <TableCell>
                <Typography className={classes.BalanceCell}>
                  {Number(fromWei(balance, "ether")).toLocaleString()}
                </Typography>
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
