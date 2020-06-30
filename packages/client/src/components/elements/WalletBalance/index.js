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
      <Typography variant="h5">
          Wallet Details
        </Typography>
      <CardContent pl={0}>
        <Table>
          <TableBody>
            {assets.map((asset, index) => (
              <TableRow>
                <TableCell style={{
                  verticalAlign:'center'
                }}>
                <img
                    alt={asset.symbol}
                    width="56"
                    height="56"
                    src={icons[asset.symbol]}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="h6" display="block">{asset.symbol}</Typography>
                  <Typography variant="body2">{asset.name}</Typography>
                </TableCell>
                <TableCell>
                  {Number(
                    fromWei(synBalances[index] || "0", "ether")
                  ).toLocaleString()}
                </TableCell>
                <TableCell>
                  <CollateralBar />
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell className={classes.TokenCell}>
              <img className={classes.TokenIcon} alt="DAI" src={icons.DAI} />
                DAI
              </TableCell>
              <TableCell>
              {Number(fromWei(balance, "ether")).toLocaleString()}
              </TableCell>
              <TableCell>
                <CollateralBar />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // return (
  //   <Paper className={classes.Paper}>
  //     <Grid container>
  //       <Grid item xs={6}>
  //         <Typography variant="h6">Token</Typography>
  //       </Grid>
  //       <Grid item xs={6} align="right">
  //         <Typography variant="h6">Balance</Typography>
  //       </Grid>
  //     </Grid>

  //     {assets.map((asset, index) => (
  //       <Grid container key={index} className={classes.SynthToken}>
  //         <Grid item xs={6}>
  //           <Box
  //             className={classes.TokenCell}
  //             display="flex"
  //             alignItems="center"
  //           >
  //             <img
  //               className={classes.TokenIcon}
  //               alt={asset.symbol}
  //               src={icons[asset.symbol]}
  //             />
  //             {asset.symbol}
  //           </Box>
  //         </Grid>
  //         <Grid item xs={6} align="right">
  //           {Number(
  //             fromWei(synBalances[index] || "0", "ether")
  //           ).toLocaleString()}
  //         </Grid>
  //         <Grid item xs={12}>
  //           <CollateralBar />
  //         </Grid>
  //       </Grid>
  //     ))}

  //     <Grid container className={classes.TokenInfo}>
  //       <Grid item xs={6}>
  //         <Box className={classes.TokenCell} display="flex" alignItems="center">
            
  //         </Box>
  //       </Grid>
  //       <Grid item xs={6} align="right">
          
  //       </Grid>
  //     </Grid>
  //   </Paper>
  // );
}
