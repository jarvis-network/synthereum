import React from "react";

import { withStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import Typography from "@material-ui/core/Typography";
import Link from "@material-ui/core/Link";
import Tooltip from "@material-ui/core/Tooltip";

import LaunchOutlined from "@material-ui/icons/LaunchOutlined";

const EtherscanIcon = withStyles(theme => ({
  root: {
    fontSize: "0.8rem",
  }
}))(LaunchOutlined);

export default function ExchangeRates(props) {
  return (
    <>
      <Typography variant="h6" gutterBottom>
        Jarvis Synthetic Tokens
      </Typography>

      <TableContainer className={props.className} component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Token</TableCell>
              <TableCell align="right">Exchange Rate</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>

            {
              props.assets.map(asset => (
                <TableRow key={asset.symbol}>
                  <TableCell>
                    {asset.symbol}
                    &nbsp;
                    <Tooltip title="View on Etherscan" placement="right">
                      <Link
                        href={
                          asset.derivative &&
                          `https://kovan.etherscan.io/token/${asset.derivative.options.address}`
                        }
                        target="_blank"
                      >
                        <EtherscanIcon color="primary" />
                      </Link>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {asset.price.toLocaleString()} DAI
                  </TableCell>
                </TableRow>
              ))
            }

          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}
