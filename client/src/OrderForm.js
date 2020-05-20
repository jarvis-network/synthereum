import React, { useState } from "react";
import { useWeb3Context } from "web3-react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import InputAdornment from "@material-ui/core/InputAdornment";

const useStyles = makeStyles(theme => ({
  button: {
    width: "50%",
  },
}));

export default function OrderForm(props) {
  const { className, assets, token, dai, setLoading, setLastTx } = props;

  const classes = useStyles();

  const context = useWeb3Context();

  const [orderType, setOrderType] = useState("buy");
  const [orderAmount, setOrderAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [collateralAmount, setCollateralAmount] = useState("0");

  const { fromWei, toWei } = context.library.utils;

  const onOrderAmountChange = event => {
    setOrderAmount(event.target.value);
    setCollateralAmount(event.target.value * assets[token].price);
    assets[token].contract.methods.calculateMintFee(toWei(collateralAmount.toString())).call()
      .then(response => {
        setFeeAmount(response);
      });
  };

  const buyOrder = orderAmount => {
    dai.methods.approve(assets[token].contract.options.address, orderAmount).send({
      from: context.account
    }).then(() => {
      return assets[token].contract.methods.mint(orderAmount).send({
        from: context.account
      });
    }).then(tx => {
      setLoading(false);
      setLastTx(tx.transactionHash);
      setOrderAmount("");
    }).catch(() => {
      setLoading(false);
      setOrderAmount("");
    });
  };

  const sellOrder = orderAmount => {
    assets[token].derivative.methods.approve(
      assets[token].contract.options.address,
      orderAmount
    ).send({
      from: context.account
    }).then(() => {
      return assets[token].contract.methods.redeemTokens(orderAmount).send({
        from: context.account
      });
    }).then(tx => {
      setLoading(false);
      setLastTx(tx.transactionHash);
      setOrderAmount("");
    }).catch(() => {
      setLoading(false);
      setOrderAmount("");
    });
  };

  const placeOrder = () => {
    if (orderAmount > 0) {
      const { toWei } = context.library.utils;
      const orderAmountTKNbits = toWei(orderAmount, "ether");

      if (orderType === "buy") {
        setLoading(true);
        buyOrder(orderAmountTKNbits);
      } else if (orderType === "sell") {
        setLoading(true);
        sellOrder(orderAmountTKNbits);
      }
    }
  };

  return (
    <>
      <Typography variant="h6" gutterBottom>
        Order Form
      </Typography>

      <form>
        <Button
          variant={orderType === "buy" ? "contained" : "outlined"}
          color="primary"
          margin="normal"
          className={classes.button}
          onClick={() => setOrderType("buy")}
        >
          Buy
        </Button>
        <Button
          variant={orderType === "sell" ? "contained" : "outlined"}
          color="secondary"
          margin="normal"
          className={classes.button}
          onClick={() => setOrderType("sell")}
        >
          Sell
        </Button>

        <TextField
          label="Amount"
          fullWidth
          margin="normal"
          value={orderAmount}
          onChange={onOrderAmountChange}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">{assets[token].symbol}</InputAdornment>
            )
          }}
        />

        <TableContainer component={Paper} className={className}>
          <Table size="small">

            <TableBody>

              <TableRow>
                <TableCell>Fee =</TableCell>
                <TableCell align="right">
                  {Number(fromWei(feeAmount)).toLocaleString()} DAI
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell>Total =</TableCell>
                <TableCell align="right">
                  {collateralAmount.toLocaleString()} DAI
                </TableCell>
              </TableRow>

            </TableBody>
          </Table>
        </TableContainer>

        <Button
          variant="contained"
          fullWidth margin="normal"
          onClick={placeOrder}
        >
          Place Order
        </Button>
      </form>
    </>
  );
}
