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
import Alert from '@material-ui/lab/Alert';

import TokenPicker from "../TokenPicker";

import useStyles from "./styles";

const SELECT_TOKEN = "select";

export default function OrderForm({ assets, dai, syntheticTokens, setLoading, setLastTx }) {
  
  const classes = useStyles();

  const context = useWeb3Context();

  const [token, setToken] = useState(0);

  const [inputToken, setInputToken] = useState(0);
  const [outputToken, setOutputToken] = useState(SELECT_TOKEN);

  const [errorMessage, setErrorMessage] = useState("");

  const [orderAmount, setOrderAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [collateralAmount, setCollateralAmount] = useState("0");

  const { fromWei, toWei, toBN } = context.library.utils;

  const onOrderAmountChange = event => {
    const { value } = event.target;
    if (!isNaN(value)) {
      console.log(assets[token]);
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

    console.log(inputToken, outputToken);
    if (outputToken === SELECT_TOKEN) return setErrorMessage("Please select a token.");
    if (inputToken === 4 && outputToken === 4) return setErrorMessage("Please pick a different token pair.");

    let orderType = "";

    if (inputToken === 4) {
      orderType = "mint";
      return window.alert("Mint.");
    } else if (outputToken === 4) {
      orderType = "redeemm";
      return window.alert("Redeem.");
    } else if (inputToken === outputToken) {
      orderType = "exchange";
      return window.alert("Exchange.");
    }

    if (orderAmount > 0) {
      const collateralAmountTKNbits = toWei(collateralAmount.toString());
      const orderAmountTKNbits = toWei(orderAmount.toString());

      if (orderType === "mint") {
        setLoading(true);
        buyOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === "redeem") {
        setLoading(true);
        sellOrder(collateralAmountTKNbits, orderAmountTKNbits);
      }
    }
  };

  return (
    <Paper className={classes.Paper}>
      <form>

        <Grid container justify="center">
          <Grid item md={12} className={classes.FormGroup}>
            <TextField
              variant="outlined"
              label="Input Token"
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={orderAmount}
              onChange={onOrderAmountChange}
              InputProps={{
                endAdornment: (
                  <TokenPicker assets={assets.concat([{
                    name: "DAI",
                    symbol: "DAI"
                  }])} token={inputToken} onChange={setInputToken} />
                )
              }}
            />
          </Grid>

          <Grid item md={12} className={classes.FormGroup}>
            <TextField
              variant="outlined"
              label="Output Token"
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={orderAmount}
              onChange={onOrderAmountChange}
              disabled={outputToken === SELECT_TOKEN}
              InputProps={{
                endAdornment: (
                  <TokenPicker assets={assets.concat([{
                    name: "DAI",
                    symbol: "DAI"
                  }])} token={outputToken} onChange={setOutputToken} />
                )
              }}
            />
          </Grid>

          <Grid item md={12}>
            {orderAmount && (
            <TableContainer component={Paper} className={classes.FeeTable}>
              <Table size="small">
                <TableBody>
                  <TableRow className={classes.TableRow}>
                    <TableCell>Fee</TableCell>
                    <TableCell align="right">
                      {Number(fromWei(feeAmount)).toLocaleString()} {assets[inputToken].symbol}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">
                      {collateralAmount.toLocaleString()} {assets[inputToken].symbol}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          )}

          </Grid>
          <Grid item md={12}>
            <Button className={classes.OrderButton} fullWidth margin="normal" onClick={placeOrder}>
              Place Order
            </Button>
            { errorMessage && (<Alert severity="error" className={classes.ErrorAlert}>{errorMessage}</Alert>)}
          </Grid>
        </Grid>        
      </form>
    </Paper>
  );
}
