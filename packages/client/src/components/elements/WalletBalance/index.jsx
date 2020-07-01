import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableRow,
  TableBody,
  TableCell
} from "@material-ui/core";
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

  const Legend = ({ }) => (
    <Box component="ul" className={classes.LegendList}>
      <li className={classes.LegendItem}>
        <Box component="div" className={classes.LegendCircle} /> User Collateral
      </li>
      <li className={classes.LegendItem}>
        <Box component="div" className={classes.LegendCircle} />
        LP Collateral
      </li>
    </Box>
  )

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

  return (
    <Card className={classes.Paper}>
      <CardHeader title="Wallet Details" className={classes.CardHeader} action={(<Legend />)} />
      <CardContent className={classes.CardContent}>
        <Table>
          <TableBody>
            {assets.map((asset, index) => {
              const value = Math.floor(Math.random() * 100) + 1;
              return (
                <TableRow key={index}>
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
                    <CollateralBar value={value} />
                  </TableCell>
                  <TableCell
                    align="right"
                    style={{
                      borderLeft: "1px solid rgba(224, 224, 224, 1)"
                    }}
                  >
                    <Typography className={classes.BalanceCell}>
                      {Number(fromWei(synBalances[index] || "0", "ether"))
                        .toFixed(3)
                        .toLocaleString()}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell>
                <img alt="DAI" width="56" height="56" src={icons.DAI} />
              </TableCell>
              <TableCell colSpan="2">
                <Typography variant="h6" display="block">
                  DAI
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography className={classes.BalanceCell}>
                  {Number(fromWei(balance, "ether")).toLocaleString()}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
