import React, { useEffect, useState } from 'react';
import { useWeb3Context } from 'web3-react';

import Notify from 'bnc-notify';

import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import TextField from '@material-ui/core/TextField';
import Alert from '@material-ui/lab/Alert';

import TokenPicker from '../TokenPicker';

import useStyles from './styles';

import { toFixedNumber, fromScaledWei, toScaledWei } from '../../../helpers/utils.js';

const SELECT_TOKEN = 'select';






export default function OrderForm({
  assets,
  collateral,
  syntheticTokens,
  setLoading,
  setLastTx,
}) {
  const classes = useStyles();

  const context = useWeb3Context();
  const [inputToken, setInputToken] = useState(assets.length);
  const [outputToken, setOutputToken] = useState(0);
  const [tokens, setTokens] = useState(assets);

  const [errorMessage, setErrorMessage] = useState('');

  const [inputAmount, setInputAmount] = useState(0);
  const [outputAmount, setOutputAmount] = useState(0);
  const [feeAmount, setFeeAmount] = useState('0');
  const [collateralAmount, setCollateralAmount] = useState('0');

  const [notify, setNotify] = useState(null);

  const { toBN } = context.library.utils;

  useEffect(() => {
    if (!notify) {
      setNotify(
        Notify({
          dappId: process.env.REACT_APP_NOTIFY_API,
          system: 'ethereum',
          networkId: context.networkId,
        }),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context.active]);

  useEffect(() => {
    const setExtendedTokens = async function (collateral, assets){
     console.log(assets);
    const collateralName = await collateral.methods.name().call();
    const collateralSymbol = await collateral.methods.symbol().call();
    const collateralDecimals = await collateral.methods.decimals().call();
    const tokensExtended = assets.concat(
      {
        name: collateralName,
        symbol: collateralSymbol,
        decimals: collateralDecimals,
        price: 1,
      });
      setTokens(tokensExtended);
    }
    setExtendedTokens(collateral, assets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets]);

  const getOrderType = () => {
    const daiIndex = assets.length;
    if (inputToken === daiIndex && outputToken < daiIndex) {
      return 'mint';
    } else if (inputToken < daiIndex && outputToken === daiIndex) {
      return 'redeem';
    } else if (inputToken < daiIndex && outputToken < daiIndex) {
      return 'exchange';
    } else {
      return null;
    }
  };

  const calculateFees = value => {
    console.log(value);
    console.log(tokens);
    console.log(inputToken);
    const token = tokens[inputToken].contract
      ? tokens[inputToken]
      : tokens[outputToken];
      console.log(token);
    if (token.contract) {

      console.log(value);
      token.contract.methods
        .calculateFee(toScaledWei(Number(value).toFixed(tokens[tokens.length - 1].decimals), tokens[tokens.length - 1].decimals))
        .call()
        .then(response => {
            console.log('reeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');
          console.log(response);
          setFeeAmount(response);
        }).catch(e=> console.log(e));
    }
  };

  const onInputAmountChange = event => {
    const { value } = event.target;
    if (!isNaN(value)) {
      setInputAmount(value);
    }
  };

  useEffect(() => {
    if (inputAmount > 0 && tokens[outputToken] && tokens[inputToken]) {
      const newCollateralAmount = inputAmount * tokens[inputToken].price;
      const tokenAmount =
            newCollateralAmount / tokens[outputToken].price;
      setCollateralAmount(newCollateralAmount);
      setOutputAmount(tokenAmount);
      calculateFees(newCollateralAmount);
    }
  }, [inputAmount, inputToken, outputToken]);

  const onOutputAmountChange = event => {
    const { value } = event.target;
    if (!isNaN(value)) {
      setOutputAmount(value);
    }
  };

  const buyOrder = (collateralAmount, orderAmountTKNbits) => {
    assets[outputToken].contract.methods
      .calculateFee(collateralAmount)
      .call()
      .then(mintFee => {
        collateral.methods
          .approve(
            assets[outputToken].contract.options.address,
            toBN(collateralAmount).add(toBN(mintFee)),
          )
          .send({
            from: context.account,
          })
          .on('transactionHash', hash => {
            notify.hash(hash);
          })
          .then(() => {
            return assets[outputToken].contract.methods
              .mintRequest(collateralAmount, orderAmountTKNbits)
              .send({
                from: context.account,
              })
              .on('transactionHash', hash => {
                notify.hash(hash);
              });
          })
          .then(tx => {
            setLoading(false);
            setLastTx(tx.transactionHash);
            setInputAmount(0);
            setOutputAmount(0);
          })
          .catch(err => {
            setLoading(false);
            setInputAmount(0);
            setOutputAmount(0);
            console.error(err);
          });
      });
  };

  const sellOrder = (collateralAmount, orderAmountTKNbits) => {
    syntheticTokens[inputToken].methods
      .approve(assets[inputToken].contract.options.address, orderAmountTKNbits)
      .send({
        from: context.account,
      })
      .on('transactionHash', hash => {
        notify.hash(hash);
      })
      .then(() => {
        return assets[inputToken].contract.methods
          .redeemRequest(collateralAmount, orderAmountTKNbits)
          .send({
            from: context.account,
          })
          .on('transactionHash', hash => {
            notify.hash(hash);
          });
      })
      .then(tx => {
        setLoading(false);
        setLastTx(tx.transactionHash);
        setInputAmount(0);
        setOutputAmount(0);
      })
      .catch(err => {
        setLoading(false);
        setInputAmount(0);
        setOutputAmount(0);
        console.error(err);
      });
  };

  const exchangeOrder = (
    inputAmountTKNbits,
    collateralAmountTKNbits,
    outputAmountTKNbits,
  ) => {
    syntheticTokens[inputToken].methods
      .approve(assets[inputToken].contract.options.address, inputAmountTKNbits)
      .send({
        from: context.account,
      })
      .on('transactionHash', hash => {
        notify.hash(hash);
      })
      .then(() => {
        return assets[inputToken].contract.methods
          .exchangeRequest(
            assets[outputToken].contract.options.address,
            inputAmountTKNbits,
            collateralAmountTKNbits,
            outputAmountTKNbits,
          )
          .send({
            from: context.account,
          })
          .on('transactionHash', hash => {
            notify.hash(hash);
          });
      })
      .then(tx => {
        setLoading(false);
        setLastTx(tx.transactionHash);
        setInputAmount(0);
        setOutputAmount(0);
      })
      .catch(err => {
        setLoading(false);
        setInputAmount(0);
        setOutputAmount(0);
        console.error(err);
      });
  };

  const placeOrder = () => {
    if (outputToken === SELECT_TOKEN)
      return setErrorMessage('Please select a token.');
    if (inputToken === 4 && outputToken === 4)
      return setErrorMessage('Please pick a different token pair.');

    if (inputAmount > 0 || outputAmount > 0) {
      const orderType = getOrderType();

      if (orderType === 'mint') {
        setLoading(true);

        const collateralAmountTKNbits = toScaledWei(Number(inputAmount).toFixed(tokens[tokens.length - 1].decimals), tokens[tokens.length - 1].decimals);

        const orderAmountTKNbits = toScaledWei(Number(outputAmount).toFixed(tokens[tokens.length - 1].decimals), 18);
        buyOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === 'redeem') {
        setLoading(true);

        const collateralAmountTKNbits = toScaledWei(Number(outputAmount).toFixed(tokens[tokens.length - 1].decimals), tokens[tokens.length - 1].decimals);
        const orderAmountTKNbits = toScaledWei(Number(inputAmount).toFixed(tokens[tokens.length - 1].decimals), 18);
        sellOrder(collateralAmountTKNbits, orderAmountTKNbits);
      } else if (orderType === 'exchange') {
        setLoading(true);
        const inputAmountTKNbits = toScaledWei(Number(inputAmount).toFixed(tokens[tokens.length - 1].decimals), 18);
        const collateralAmountTKNbits = toScaledWei(
          Number(collateralAmount).toFixed(tokens[tokens.length - 1].decimals), tokens[tokens.length - 1].decimals);
        const outputAmountTKNbits = toScaledWei(Number(outputAmount).toFixed(tokens[tokens.length - 1].decimals), 18);
        exchangeOrder(
          inputAmountTKNbits,
          collateralAmountTKNbits,
          outputAmountTKNbits,
        );
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
              label={'From'}
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={inputAmount}
              onChange={onInputAmountChange}
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <TokenPicker
                    assets={tokens}
                    token={inputToken}
                    onChange={setInputToken}
                  />
                ),
              }}
            />
          </Grid>

          <Grid item md={12} className={classes.FormGroup}>
            <TextField
              variant="outlined"
              label={'To (estimated)'}
              placeholder="0.0"
              fullWidth
              margin="normal"
              value={outputAmount.toFixed(5)}
              onChange={onOutputAmountChange}
              disabled={true}
              InputLabelProps={{
                shrink: true,
              }}
              InputProps={{
                endAdornment: (
                  <TokenPicker
                    assets={tokens}
                    token={outputToken}
                    onChange={setOutputToken}
                  />
                ),
              }}
            />
          </Grid>

          <Grid item md={12}>
            {outputAmount > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow className={classes.TableRow}>
                      <TableCell>Fee</TableCell>
                      <TableCell align="right">
                        {toFixedNumber(fromScaledWei(feeAmount, tokens[tokens.length - 1].decimals), 5)}{' '}
                        {tokens[tokens.length - 1].symbol}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Grid>
          <Grid item md={12}>
            <Button
              className={classes.OrderButton}
              fullWidth
              margin="normal"
              onClick={placeOrder}
            >
              Place Order
            </Button>
            {errorMessage && (
              <Alert severity="error" className={classes.ErrorAlert}>
                {errorMessage}
              </Alert>
            )}
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
}
