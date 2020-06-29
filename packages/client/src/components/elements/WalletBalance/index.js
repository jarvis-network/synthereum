import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";
import Grid from "@material-ui/core/Grid";

import Container from "@material-ui/core/Container";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";

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
      <TableContainer>
        <Table>
          <TableHead className={classes.TableHead}>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset, index) => (
              <React.Fragment key={index}>
                <TableRow className={classes.TableRow}>
                  <TableCell className={classes.TokenCell}>
                    <img
                      className={classes.TokenIcon}
                      alt={asset.symbol}
                      src={icons[asset.symbol]}
                    />
                    {asset.symbol}
                  </TableCell>
                  <TableCell align="right">
                    {Number(
                      fromWei(synBalance, "ether")
                    ).toLocaleString()}
                  </TableCell>
                </TableRow>
                <TableRow className={classes.TableRow}>
                  <TableCell
                    colSpan="2"
                    className={classes.TableCellCollateral}
                  >
                    <CollateralBar />
                  </TableCell>
                </TableRow>
              </React.Fragment>
            ))}
            <TableRow className={classes.TableRow}>
              <TableCell className={classes.TokenCell}>
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
  );
}
