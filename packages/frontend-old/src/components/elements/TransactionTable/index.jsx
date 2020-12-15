import React, { useState, useEffect } from 'react';
import moment from 'moment';
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
} from '@material-ui/core';
import StatusLabel from './StatusLabel';
import useStyles from './styles';
import { useWeb3Context } from 'web3-react';
import * as icons from '../../../assets/icons';
import Loader from '../Loader';
import { toFixedNumber, fromScaledWei, toScaledWei } from '../../../helpers/utils.js';

const getStatus = (ev, approvedEvents, rejectedEvents, idField) => {
  let status = 'pending';
  if (
    approvedEvents.find(
      e => e.returnValues[idField] === ev.returnValues[idField],
    )
  ) {
    status = 'approved';
  }
  if (
    rejectedEvents.find(
      e => e.returnValues[idField] === ev.returnValues[idField],
    )
  ) {
    status = 'rejected';
  }

  return {
    ...ev,
    status,
  };
};

const TransactionTable = ({ assets, collateral,token }) => {
  const classes = useStyles();
  const context = useWeb3Context();
  const { fromWei } = context.library.utils;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decimals, setDecimals] = useState(0);

  // TODO: should only render component once contracts are ready
  const contractsReady = assets[0].contract ? true : false;

  async function listEvents(eventNames, idField) {
    try {
      let collateralSymbol = await collateral.methods.symbol().call();
      const blockNumber = await context.library.eth.getBlockNumber();
      console.log(blockNumber, 'blockNumber');

      let [requestedEvents, approvedEvents, rejectedEvents] = await Promise.all(
        eventNames.map(eventName =>
          assets[token].contract.getPastEvents(eventName, {
            filter: { sender: context.account },
            fromBlock: 0,
            // fromBlock: blockNumber - 1000000, // TODO
            toBlock: 'latest',
          }),
        ),
      );

      requestedEvents = requestedEvents.map(ev =>
        getStatus(ev, approvedEvents, rejectedEvents, idField),
      );

      let toAsset, fromAsset;

      if (eventNames[0] === 'MintRequested') {
        toAsset = assets[token].symbol;
        fromAsset = collateralSymbol;
        return requestedEvents.map(ev => {
          return {
            ...ev,
            toAsset,
            fromAsset,
          };
        });
      } else if (eventNames[0] === 'RedeemRequested') {
        toAsset = collateralSymbol;
        fromAsset = assets[token].symbol;
        return requestedEvents.map(ev => {
          return {
            ...ev,
            toAsset,
            fromAsset,
          };
        });
      } else if (eventNames[0] === 'ExchangeRequested') {
        fromAsset = assets[token].symbol;
        const toTIC = requestedEvents.map(event => {
          const ticAddress = event.returnValues.destTIC;
          const asset = assets.filter(
            asset => asset.contract.options.address === ticAddress,
          );
          return asset[0].symbol;
        });
        return requestedEvents.map((ev, index) => {
          const toAsset = toTIC[index];
          return {
            ...ev,
            toAsset,
            fromAsset,
          };
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function getEvents() {
    try {
      setLoading(true);

      let mintEvents = await listEvents(
        ['MintRequested', 'MintApproved', 'MintRejected'],
        'mintID',
      );

      let redeemEvents = await listEvents(
        ['RedeemRequested', 'RedeemApproved', 'RedeemRejected'],
        'redeemID',
      );

      let exchangeEvents = await listEvents(
        ['ExchangeRequested', 'ExchangeApproved', 'ExchangeRejected'],
        'exchangeID',
      );

      setEvents(
        mintEvents
          .concat(redeemEvents)
          .concat(exchangeEvents)
          .sort((a, b) => b.returnValues.timestamp - a.returnValues.timestamp),
      );
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (contractsReady) {
      getEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractsReady, token]);

  useEffect(() => {
    if (context.active && collateral) {
      collateral.methods
        .decimals()
        .call()
        .then(decimalsNumber => setDecimals(decimalsNumber));
    }
  }, [context, context.active, collateral]);

  return (
    <Paper className={classes.Paper}>
      {loading ? (
        <Loader />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Transaction</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell align="right">Status</TableCell>
            </TableRow>
          </TableHead>

          {events.length > 0 ? (
            <TableBody>
              {events.map((ev, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {ev.event
                      .replace('Requested', '')
                      .replace('Approved', '')
                      .replace('Rejected', '')}
                  </TableCell>
                  <TableCell>
                    {moment(parseInt(ev.returnValues.timestamp) * 1000).format(
                      'M/D/YY h:mma',
                    )}
                  </TableCell>
                  {ev.event === 'MintRequested' ||
                  ev.event === 'RedeemRequested' ? (
                    <TableCell className={classes.InputAmount}>
                      <Box component="div" className={classes.AssetCell}>
                        <img
                          alt={ev.fromAsset}
                          width="28"
                          height="28"
                          src={icons[ev.fromAsset]}
                        />
                        {`-${toFixedNumber(
                          ev.event === 'RedeemRequested' ?
                          fromScaledWei(
                            ev.returnValues['numTokens'],
                              18
                             ): fromScaledWei(
                            ev.returnValues['collateralAmount'],
                            decimals),

                          5
                        )}`}
                      </Box>
                    </TableCell>
                  ) : (
                    <TableCell className={classes.InputAmount}>
                      <Box component="div" className={classes.AssetCell}>
                        <img
                          alt={ev.fromAsset}
                          width="28"
                          height="28"
                          src={icons[ev.fromAsset]}
                        />
                        {`-${toFixedNumber(
                          fromScaledWei(ev.returnValues['numTokens'], 18),
                          5,
                        )}`}
                      </Box>
                    </TableCell>
                  )}
                  {ev.event === 'MintRequested' ||
                  ev.event === 'RedeemRequested' ? (
                    <TableCell className={classes.OutputAmount}>
                      <Box component="div" className={classes.AssetCell}>
                        <img
                          alt={ev.toAsset}
                          width="28"
                          height="28"
                          src={icons[ev.toAsset]}
                        />
                        {`+${toFixedNumber(ev.event === 'RedeemRequested' ?
                          fromScaledWei(
                            ev.returnValues['collateralAmount'],
                              decimals
                             ): fromScaledWei(
                            ev.returnValues['numTokens'],
                            18),
                          5,
                        )}`}
                      </Box>
                    </TableCell>
                  ) : (
                    <TableCell className={classes.OutputAmount}>
                      <Box component="div" className={classes.AssetCell}>
                        <img
                          alt={ev.toAsset}
                          width="28"
                          height="28"
                          src={icons[ev.toAsset]}
                        />
                        {`+${toFixedNumber(
                          fromWei(ev.returnValues['destNumTokens']),
                          5,
                        )}`}
                      </Box>
                    </TableCell>
                  )}
                  <TableCell align="right">
                    {ev.status && (
                      <StatusLabel status={ev.status || 'pending'} />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : (
            <TableBody>
              <TableRow>
                <TableCell colSpan="5" align="center">
                  <Typography variant="h6">
                    No transactions to display.
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          )}

          {/* <TableFooter>
            <TableRow>
              <TableCell colSpan="6" align="center">
                1
              </TableCell>
            </TableRow>
          </TableFooter> */}
        </Table>
      )}
    </Paper>
  );
};

export default TransactionTable;
