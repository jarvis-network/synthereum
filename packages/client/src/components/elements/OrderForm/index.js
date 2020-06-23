import React, { useState } from "react";
import { useWeb3Context } from "web3-react";

import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableContainer from "@material-ui/core/TableContainer";
import TableRow from "@material-ui/core/TableRow";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import TokenPicker from "../TokenPicker";

import useStyles from "./styles";

export default function OrderForm(props) {
  const {
    assets,
    // token,
    dai,
    syntheticTokens,
    setLoading,
    setLastTx
  } = props;

  const classes = useStyles();

  const context = useWeb3Context();

  const [token, setToken] = useState(0);

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
      assets[token].contract.methods
        .calculateMintFee(toWei(newCollateralAmount.toString()))
        .call()
        .then(response => {
          setFeeAmount(response);
        });
    }
  };

  const buyOrder = (collateralAmount, orderAmountTKNbits) => {
    assets[token].contract.methods
      .calculateMintFee(collateralAmount)
      .call()
      .then(mintFee => {
        dai.methods
          .approve(
            assets[token].contract.options.address,
            toBN(collateralAmount).add(toBN(mintFee))
          )
          .send({
            from: context.account
          })
          .then(() => {
            return assets[token].contract.methods
              .mintRequest(collateralAmount, orderAmountTKNbits)
              .send({
                from: context.account
              });
          })
          .then(tx => {
            setLoading(false);
            setLastTx(tx.transactionHash);
            setOrderAmount("");
          })
          .catch(err => {
            setLoading(false);
            setOrderAmount("");
            console.error(err);
          });
      });
  };

  const sellOrder = (collateralAmount, orderAmountTKNbits) => {
    syntheticTokens[token].methods
      .approve(assets[token].contract.options.address, orderAmountTKNbits)
      .send({
        from: context.account
      })
      .then(() => {
        return assets[token].contract.methods
          .redeemRequest(collateralAmount, orderAmountTKNbits)
          .send({
            from: context.account
          });
      })
      .then(tx => {
        setLoading(false);
        setLastTx(tx.transactionHash);
        setOrderAmount("");
      })
      .catch(err => {
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
    <Paper className={classes.Paper}>
      <form>
        <div className={classes.ButtonRow}>
          <Button
            className={orderType === "buy" ? classes.ActionButtonActive : classes.ActionButton}
            color="primary"
            margin="normal"
            onClick={() => setOrderType("buy")}
          >
            Buy
          </Button>
          <Button
            className={orderType === "sell" ? classes.ActionButtonActive : classes.ActionButton}
            color="secondary"
            margin="normal"
            onClick={() => setOrderType("sell")}
          >
            Sell
          </Button>
          <Button
            className={orderType === "exchange" ? classes.ActionButtonActive : classes.ActionButton}
            color="secondary"
            margin="normal"
            onClick={() => alert("Exchange")}
          >
            Exchange
          </Button>
        </div>
        
        <Grid container justify="center">
          <Grid item md={8}>
            <TextField
              variant="outlined"
              label="Amount"
              fullWidth
              margin="normal"
              value={orderAmount}
              onChange={onOrderAmountChange}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <TokenPicker assets={assets} token={token} onChange={setToken} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item md={8}>
            {orderAmount && (
            <TableContainer component={Paper} className={classes.FeeTable}>
              <Table size="small">
                <TableBody>
                  <TableRow className={classes.TableRow}>
                    <TableCell>Fee</TableCell>
                    <TableCell align="right">
                      {Number(fromWei(feeAmount)).toLocaleString()} DAI
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">
                      {collateralAmount.toLocaleString()} DAI
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          </Grid>
          <Grid item md={8}>
            <Button className={classes.OrderButton} fullWidth margin="normal" onClick={placeOrder}>
              Place Order
            </Button>
          </Grid>
        </Grid>        
      </form>
    </Paper>
  );
}
