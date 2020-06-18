import React, { useState } from "react";
import { useWeb3Context } from "web3-react";
import styled from "styled-components";

import Grid from "@material-ui/core/Grid";
import Box from "@material-ui/core/Box";
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
import colors from "../../../helpers/colors";

const StyledBox = styled(Box)`
  background-color: white;
  padding: 20px;
  box-shadow: rgba(0, 0, 0, 0.01) 0px 0px 1px, rgba(0, 0, 0, 0.04) 0px 4px 8px,
    rgba(0, 0, 0, 0.04) 0px 16px 24px, rgba(0, 0, 0, 0.01) 0px 24px 32px;
  border-radius: 20px;
`;

const ButtonRow = styled.div`
  display: flex;
  justify-content: space-evenly;
  width: 100%;
`;

const ActionButton = styled(Button)`
  background: transparent;
  width: 100%;
  text-transform: none;
  font-size: 18px;
  ${props =>
    props.active === "true"
      ? `
    color: black;
  `
      : `
    color: #ccc;
  `}
  :hover {
    color: #aaa;
    background: transparent;
  }
`;

const OrderButton = styled(Button)`
  drop-shadow: none;
  background-color: ${colors.green};
  color: black;
  text-transform: uppercase;
  font-size: 1rem;
  border-radius: 3px;
  padding: 1rem 3rem;
  font-family: 'Rubik', sans-serif;
  font-weight: 500;
  :hover {
    background-color: ${colors.darkGreen};
  }
`;


export default function OrderForm(props) {
  const {
    className,
    assets,
    // token,
    dai,
    syntheticTokens,
    setLoading,
    setLastTx
  } = props;

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
    <StyledBox>
      <form>
        <ButtonRow>
          <ActionButton
            active={orderType === "buy" ? "true" : "false"}
            color="primary"
            margin="normal"
            onClick={() => setOrderType("buy")}
          >
            Buy
          </ActionButton>
          <ActionButton
            active={orderType === "sell" ? "true" : "false"}
            color="secondary"
            margin="normal"
            onClick={() => setOrderType("sell")}
          >
            Sell
          </ActionButton>
          <ActionButton
            active={orderType === "exchange" ? "true" : "false"}
            color="secondary"
            margin="normal"
            onClick={() => alert("Exchange")}
          >
            Exchange
          </ActionButton>
        </ButtonRow>
        
        <Grid container justify="center">
          <Grid item md={8}>
            <TextField
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
            <TableContainer component={Paper} className={className}>
              <Table size="small">
                <TableBody>
                  <TableRow>
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
            <OrderButton fullWidth margin="normal" onClick={placeOrder}>
              Place Order
            </OrderButton>
          </Grid>
        </Grid>        
      </form>
    </StyledBox>
  );
}
