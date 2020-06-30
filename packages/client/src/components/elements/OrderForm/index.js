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
  const [inputToken, setInputToken] = useState(assets.length);
  const [outputToken, setOutputToken] = useState(0);

  const [errorMessage, setErrorMessage] = useState("");

  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [feeAmount, setFeeAmount] = useState("0");
  const [collateralAmount, setCollateralAmount] = useState("0");

  const { fromWei, toWei, toBN } = context.library.utils;

  const tokens = assets.concat([{
    name: "DAI",
    symbol: "DAI"
  }]);

  const getOrderType = () => {
    if (inputToken === 4 && outputToken < 4) {
      return "mint";
    } else if (inputToken < 4 && outputToken === 4) {
      return "redeem";
    } else if (inputToken < 4 && outputToken < 4) {
      return "exchange";
    } else {
      return null;
    }
  }

  const calculateFees = value => {
    if (getOrderType() === "mint") {
      const newCollateralAmount = value * assets[outputToken].price;
      setCollateralAmount(newCollateralAmount);
      assets[outputToken].contract.methods
        .calculateMintFee(toWei(newCollateralAmount.toString()))
        .call()
        .then(response => {
          setFeeAmount(response);
        });
    }
  };

  const onInputAmountChange = event => {
    const { value } = event.target;

    if (!isNaN(value)) {
      setInputAmount(value);
      calculateFees(value);
    }
  };

  const onOutputAmountChange = event => {
    const { value } = event.target;

    if (!isNaN(value)) {
      setOutputAmount(value);
      calculateFees(value);
    }
  };

  const buyOrder = (collateralAmount, orderAmountTKNbits) => {
    assets[outputToken].contract.methods
      .calculateMintFee(collateralAmount)
      .call()
      .then(mintFee => {
        dai.methods
          .approve(
            assets[outputToken].contract.options.address,
            toBN(collateralAmount).add(toBN(mintFee))
          )
          .send({
            from: context.account
          })
          .then(() => {
            return assets[outputToken].contract.methods
              .mintRequest(collateralAmount, orderAmountTKNbits)
              .send({
                from: context.account
              });
          })
          .then(tx => {
            setLoading(false);
            setLastTx(tx.transactionHash);
            setInputAmount("");
            setOutputAmount("");
          })
          .catch(err => {
            setLoading(false);
            setInputAmount("");
            setOutputAmount("");
            console.error(err);
          });
      });
  };

  const sellOrder = (collateralAmount, orderAmountTKNbits) => {
    syntheticTokens[inputToken].methods
      .approve(assets[inputToken].contract.options.address, orderAmountTKNbits)
      .send({
        from: context.account
      })
      .then(() => {
        return assets[inputToken].contract.methods
          .redeemRequest(collateralAmount, orderAmountTKNbits)
          .send({
            from: context.account
          });
      })
      .then(tx => {
        setLoading(false);
        setLastTx(tx.transactionHash);
        setInputAmount("");
        setOutputAmount("");
      })
      .catch(err => {
        setLoading(false);
        setInputAmount("");
        setOutputAmount("");
        console.error(err);
      });
  };

  const exchangeOrder = (inputAmountTKNbits, outputAmountTKNbits) => {
    syntheticTokens[inputToken].methods
      .approve(assets[inputToken].contract.options.address, inputAmountTKNbits)
      .send({
        from: context.account
      })
      .then(() => {
        return assets[inputToken].contract.methods
          .exchangeRequest(
            assets[outputToken].contract.options.address,
            inputAmountTKNbits,
            outputAmountTKNbits
          )
          .send({
            from: context.account
          });
      })
      .then(tx => {
        setLoading(false);
        setLastTx(tx.transactionHash);
        setInputAmount("");
        setOutputAmount("");
      })
      .catch(err => {
        setLoading(false);
        setInputAmount("");
        setOutputAmount("");
        console.error(err);
      });
  };

  const placeOrder = () => {

    console.log(inputToken, outputToken);
    if (outputToken === SELECT_TOKEN) return setErrorMessage("Please select a token.");
    if (inputToken === 4 && outputToken === 4) return setErrorMessage("Please pick a different token pair.");

    if (inputAmount > 0 || outputAmount > 0) {
      const orderType = getOrderType();

      if (orderType === "mint") {
        setLoading(true);

        const collateralAmountTKNbits = toWei(collateralAmount.toString());
        const orderAmountTKNbits = toWei(outputAmount.toString());
        buyOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === "redeem") {
        setLoading(true);

        const collateralAmountTKNbits = toWei(collateralAmount.toString());
        const orderAmountTKNbits = toWei(inputAmount.toString());
        sellOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === "exchange") {
        setLoading(true);

        const inputAmountTKNbits = toWei(inputAmount.toString());
        const outputAmountTKNbits = toWei(inputAmount.toString());
        exchangeOrder(inputAmountTKNbits, outputAmountTKNbits);
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
              
              label={getOrderType() === "mint" ? "From (estimated)" : "From"}
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={inputAmount}
              onChange={onInputAmountChange}
              disabled={getOrderType() === "mint"}
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <TokenPicker assets={tokens} token={inputToken} onChange={setInputToken} />
                )
              }}
            />
          </Grid>

          <Grid item md={12} className={classes.FormGroup}>
            <TextField
              variant="outlined"
              label={getOrderType() === "mint" ? "To" : "To (estimated)"}
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={outputAmount}
              onChange={onOutputAmountChange}
              disabled={getOrderType() !== "mint"}
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <TokenPicker assets={tokens} token={outputToken} onChange={setOutputToken} />
                )
              }}
            />
          </Grid>

          <Grid item md={12}>
            {outputAmount && getOrderType() === "mint" && (
            <TableContainer component={Paper} className={classes.FeeTable}>
              <Table size="small">
                <TableBody>
                  <TableRow className={classes.TableRow}>
                    <TableCell>Fee</TableCell>
                    <TableCell align="right">
                      {Number(fromWei(feeAmount)).toLocaleString()} {tokens[inputToken].symbol}
                    </TableCell>
                  </TableRow>

                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell align="right">
                      {collateralAmount.toLocaleString()} {tokens[inputToken].symbol}
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
