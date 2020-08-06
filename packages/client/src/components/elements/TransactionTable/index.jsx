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

const TransactionTable = ({ assets, token }) => {
  const classes = useStyles();
  const context = useWeb3Context();
  const { fromWei } = context.library.utils;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // TODO: should only render component once contracts are ready
  const contractsReady = assets[0].contract ? true : false;

  async function listEvents(eventNames, idField) {
    try {
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
        fromAsset = 'DAI';
      } else if (eventNames[0] === 'RedeemRequested') {
        toAsset = 'DAI';
        fromAsset = assets[token].symbol;
      } else if (eventNames[0] === 'ExchangeRequested') {
        fromAsset = assets[token].symbol;
        /// TODO: toAsset using address
      }

      return requestedEvents.map(ev => {
        return {
          ...ev,
          toAsset,
          fromAsset,
        };
      });
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
                        {`-${Number(
                          fromWei(
                            ev.returnValues[
                              ev.event === 'RedeemRequested'
                                ? 'numTokens'
                                : 'collateralAmount'
                            ],
                          ),
                        ).toLocaleString()}`}
                      </Box>
                    </TableCell>
                  ) : (
                    <TableCell></TableCell>
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
                        {`+${Number(
                          fromWei(
                            ev.returnValues[
                              ev.event === 'RedeemRequested'
                                ? 'collateralAmount'
                                : 'numTokens'
                            ],
                          ),
                        ).toLocaleString()}`}
                      </Box>
                    </TableCell>
                  ) : (
                    <TableCell></TableCell>
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
