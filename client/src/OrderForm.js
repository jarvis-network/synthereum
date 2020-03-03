import React, { useState } from "react";
import { useWeb3Context } from "web3-react";

import { makeStyles } from "@material-ui/core/styles";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Typography from "@material-ui/core/Typography";
import InputAdornment from "@material-ui/core/InputAdornment";

const useStyles = makeStyles(theme => ({
  button: {
    width: "50%",
  },
}));

export default function OrderForm(props) {
  const { assets, token, dai, setLoading, setLastTx } = props;

  const classes = useStyles();

  const context = useWeb3Context();

  const [orderType, setOrderType] = useState("buy");
  const [orderAmount, setOrderAmount] = useState("");

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
          onChange={event => setOrderAmount(event.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {orderType === "buy" ? "DAI" : assets[token].symbol}
              </InputAdornment>
            )
          }}
        />

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
