import React, { useEffect, useState } from 'react';
import { useWeb3React } from '@web3-react/core';

import {
  Box,
  Card,
  CardHeader,
  CardContent,
  Table,
  TableRow,
  TableBody,
  TableCell,
} from '@material-ui/core';
import Typography from '@material-ui/core/Typography';

import * as icons from '../../../assets/icons';

import useStyles from './styles';
import CollateralBar from '../CollateralBar';
import { toFixedNumber, fromScaledWei } from '../../../helpers/utils.js';

export default function WalletBalance({
  assets,
  syntheticTokens,
  token,
  collateral,
  lastTx,
}) {
  const classes = useStyles();

  const context = useWeb3React();

  const [synBalances, setSynBalances] = useState(
    Array(syntheticTokens.length).fill('0'),
  );
  const [balance, setBalance] = useState('0');

  const [decimals, setDecimals] = useState('0');

  const [collateralSymbol, setCollateralSymbol] = useState('');

  const { fromWei } = context.library.utils;

  const Legend = () => (
    <Box component="ul" className={classes.LegendList}>
      <li className={classes.LegendItem}>
        <Box component="div" className={classes.LegendCircle} /> User Collateral
      </li>
      <li className={classes.LegendItem}>
        <Box component="div" className={classes.LegendCircle} />
        LP Collateral
      </li>
    </Box>
  );

  useEffect(() => {
    async function setSubscriptions() {
      try {
        // TODO: add params/filter
        const subscription = context.library.eth.subscribe('MintApproved');
        console.log(subscription);
      } catch (err) {
        console.error(err);
      }
    }

    setSubscriptions();
  }, [context.library.eth]);

  useEffect(() => {
    if (context.active) {
      Promise.all(
        syntheticTokens.map((token, i) => {
          if (token) {
            return token.methods.balanceOf(context.account).call();
          } else {
            return null;
          }
        }),
      ).then(synBalances => {
        setSynBalances(synBalances);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context.active, syntheticTokens, token, lastTx]);

  useEffect(() => {
    if (context.active && collateral) {
      collateral.methods
        .decimals()
        .call()
        .then(decimalsNumber => setDecimals(decimalsNumber));
      collateral.methods
        .symbol()
        .call()
        .then(symbolName => setCollateralSymbol(symbolName));
    }
  }, [context, context.active, collateral, lastTx]);

  useEffect(() => {
    if (context.active && collateral) {
      collateral.methods
        .balanceOf(context.account)
        .call()
        .then(balance => setBalance(balance));
    }
  }, [context, context.active, collateral, lastTx]);

  return (
    <Card className={classes.Paper}>
      <CardHeader
        title="Wallet Details"
        className={classes.CardHeader}
        action={<Legend />}
      />
      <CardContent className={classes.CardContent}>
        <Table>
          <TableBody>
            {assets.map((asset, index) => {
              const value = asset.price * fromWei(asset.totalTokens.toString());
              const total = fromScaledWei(
                asset.collateral.toString(),
                decimals,
              );
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
                    <CollateralBar value={value} total={total} />
                  </TableCell>
                  <TableCell
                    align="right"
                    style={{
                      borderLeft: '1px solid rgba(224, 224, 224, 1)',
                    }}
                  >
                    <Typography className={classes.BalanceCell}>
                      {toFixedNumber(
                        fromWei(synBalances[index] || '0', 'ether'),
                        5,
                      )}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell>
                <img alt="DAI" width="56" height="56" src={icons.USDC} />
              </TableCell>
              <TableCell colSpan="2">
                <Typography variant="h6" display="block">
                  {collateralSymbol}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <Typography className={classes.BalanceCell}>
                  {toFixedNumber(fromScaledWei(balance, decimals), 5)}
                </Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
