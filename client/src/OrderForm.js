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
  const { className, assets, token, dai, syntheticTokens, setLoading, setLastTx } = props;

  const classes = useStyles();

  const context = useWeb3Context();

  const [orderType, setOrderType] = useState("buy");
  const [orderAmount, setOrderAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [collateralAmount, setCollateralAmount] = useState("0");

  const { fromWei, toWei, toBN } = context.library.utils;

  const onOrderAmountChange = event => {
    const { value } = event.target;
    if (!isNaN(value)) {
      const newCollateralAmount = value * assets[token].price;
      setOrderAmount(value);
      setCollateralAmount(newCollateralAmount);
      assets[token].contract.methods.calculateMintFee(toWei(newCollateralAmount.toString())).call()
        .then(response => {
          setFeeAmount(response);
        });
    }
  };

  const buyOrder = (collateralAmount, orderAmountTKNbits) => {
    assets[token].contract.methods.calculateMintFee(collateralAmount).call()
      .then(mintFee => {
        dai.methods.approve(
          assets[token].contract.options.address,
          toBN(collateralAmount).add(toBN(mintFee))
        ).send({
          from: context.account
        }).then(() => {
          return assets[token].contract.methods.mintRequest(
            collateralAmount,
            orderAmountTKNbits
          ).send({
            from: context.account
          });
        }).then(tx => {
          setLoading(false);
          setLastTx(tx.transactionHash);
          setOrderAmount("");
        }).catch(err => {
          setLoading(false);
          setOrderAmount("");
          console.error(err);
        });
      });
  };

  const sellOrder = (collateralAmount, orderAmountTKNbits) => {
    syntheticTokens[token].methods.approve(
      assets[token].contract.options.address,
      orderAmountTKNbits
    ).send({
      from: context.account
    }).then(() => {
      return assets[token].contract.methods.redeemRequest(
        collateralAmount,
        orderAmountTKNbits
      ).send({
        from: context.account
      });
    }).then(tx => {
      setLoading(false);
      setLastTx(tx.transactionHash);
      setOrderAmount("");
    }).catch(err => {
      setLoading(false);
      setOrderAmount("");
      console.error(err);
    });
  };

  const placeOrder = () => {
    if (orderAmount > 0) {
      const collateralAmountTKNbits = toWei(collateralAmount.toString());
      const orderAmountTKNbits = toWei(orderAmount.toString());

      if (orderType === "buy") {
        setLoading(true);
        buyOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === "sell") {
        setLoading(true);
        sellOrder(collateralAmountTKNbits, orderAmountTKNbits);
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
