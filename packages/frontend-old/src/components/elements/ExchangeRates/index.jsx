import React from 'react';

import { withStyles } from '@material-ui/core/styles';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Link from '@material-ui/core/Link';
import Tooltip from '@material-ui/core/Tooltip';

import LaunchOutlined from '@material-ui/icons/LaunchOutlined';

import useStyles from './styles';

import * as icons from '../../../assets/icons';

const EtherscanIcon = withStyles(theme => ({
  root: {
    fontSize: '0.8rem',
  },
}))(LaunchOutlined);

export default function ExchangeRates({ assets, syntheticTokens }) {
  const classes = useStyles();

  return (
    <TableContainer component={Paper} className={classes.Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Token</TableCell>
            <TableCell align="right">Exchange Rate</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {assets.map((asset, index) => (
            <TableRow key={asset.symbol}>
              <TableCell className={classes.TokenCell}>
                <img
                  className={classes.TokenIcon}
                  alt={asset.symbol}
                  src={icons[asset.symbol]}
                />
                {asset.symbol}
                &nbsp;
                <Tooltip title="View on Etherscan" placement="right">
                  <Link
                    href={
                      asset.derivative &&
                      `https://kovan.etherscan.io/token/${syntheticTokens[index].options.address}`
                    }
                    target="_blank"
                  >
                    <EtherscanIcon color="primary" />
                  </Link>
                </Tooltip>
              </TableCell>
              <TableCell align="right">
                {asset.price.toLocaleString()} USDC
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
