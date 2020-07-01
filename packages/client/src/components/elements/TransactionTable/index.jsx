import React, { useState, useEffect } from "react";
import moment from "moment";
import {
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableFooter,
  Typography
} from "@material-ui/core";
import StatusLabel from "./StatusLabel";
import useStyles from "./styles";
import { useWeb3Context } from "web3-react";
import * as icons from "../../../assets/icons";
import Loader from "../Loader";

const TOKEN_INDEX = 0;

const getStatus = (ev, approvedEvents, rejectedEvents) => {
  
  let status = "pending";
  if (approvedEvents.find(e => e.returnValues.mintId === ev.returnValues.mintId)) {
    status = "approved";
  }
  if (rejectedEvents.find(e => e.returnValues.mintId === ev.returnValues.mintId)) {
    status = "rejected";
  }

  return {
    ...ev,
    status
  };

};

const TransactionTable = ({ assets }) => {
  const classes = useStyles();
  const context = useWeb3Context();
  const { fromWei } = context.library.utils;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // TODO: should only render component once contracts are ready
  const contractsReady = assets[0].contract ? true : false;

  async function listEvents(eventNames) {
    try {

      let [requestedEvents, approvedEvents, rejectedEvents] = await Promise.all(eventNames.map(eventName => assets[TOKEN_INDEX].contract.getPastEvents(eventName, {
        filter: { sender: context.account },
        fromBlock: 0, // TODO: subtract 1,000,000 from web3.eth.getBlockNumber(), set floor to 0
        toBlock: "latest"
      })));

      console.log(requestedEvents);
      console.log(approvedEvents);
      console.log(rejectedEvents);

      requestedEvents = requestedEvents.map(ev => getStatus(ev, approvedEvents, rejectedEvents));

      let toAsset, fromAsset;

      if (eventNames[0] === "MintRequested") {
        toAsset = assets[TOKEN_INDEX].symbol;
        fromAsset = "DAI";
      } else if (eventNames[0] === "RedeemRequested") {
        toAsset = "DAI";
        fromAsset = assets[TOKEN_INDEX].symbol;
      } else if (eventNames[0] === "ExchangeRequested") {
        fromAsset = assets[TOKEN_INDEX].symbol;
        /// TODO: toAsset using address
      }

      return requestedEvents.map(ev => {
        return {
          ...ev,
          toAsset,
          fromAsset
        };
      });

    } catch(err) {
      console.error(err);
    }
  }

  async function getEvents() {
  
    try {

      let mintEvents = await listEvents([
        "MintRequested",
        "MintApproved",
        "MintRejected"
      ]);

      let redeemEvents = await listEvents([
        "RedeemRequested",
        "RedeemApproved",
        "RedeemRejected"
      ]);

      let exchangeEvents = await listEvents([
        "ExchangeRequested",
        "ExchangeApproved",
        "ExchangeRejected"
      ]);

      console.log(mintEvents);
      console.log(redeemEvents);
      console.log(exchangeEvents);
      
      setEvents(mintEvents.concat(redeemEvents).concat(exchangeEvents));
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    if (contractsReady) {
      getEvents();
    }
  }, [contractsReady]);

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

          {
              events.length > 0 ? (
                <TableBody>
                    {events.map((ev, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            {ev.event.replace("Requested","").replace("Approved","").replace("Rejected","")}
                        </TableCell>
                        <TableCell>
                        {moment(parseInt(ev.returnValues.timestamp) * 1000).format(
                            "M/D/YY h:mma"
                        )}
                        </TableCell>
                        {ev.event === "MintRequested" ||
                        ev.event === "RedeemRequested" ? (
                        <TableCell className={classes.InputAmount}>
                            <Box component="div" className={classes.AssetCell}>
                            <img
                                alt={ev.fromAsset}
                                width="28"
                                height="28"
                                src={icons[ev.fromAsset]}
                            />
                            {`-${fromWei(
                                ev.returnValues[
                                ev.event === "RedeemRequested"
                                    ? "numTokens"
                                    : "collateralAmount"
                                ]
                            )}`}
                            
                            </Box>
                        </TableCell>
                        ) : (
                        <TableCell></TableCell>
                        )}
                        {ev.event === "MintRequested" ||
                        ev.event === "RedeemRequested" ? (
                        <TableCell className={classes.OutputAmount}>
                            <Box component="div" className={classes.AssetCell}>
                            <img
                                alt={ev.toAsset}
                                width="28"
                                height="28"
                                src={icons[ev.toAsset]}
                            />
                            {`+${fromWei(
                                ev.returnValues[
                                ev.event === "RedeemRequested"
                                    ? "collateralAmount"
                                    : "numTokens"
                                ]
                            )}`}
                            
                            </Box>
                        </TableCell>
                        ) : (
                        <TableCell></TableCell>
                        )}
                        <TableCell align="right">
                          { ev.status && (<StatusLabel status={ev.status || "pending"} />)}
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
              ) : (
                <TableBody>
                    <TableRow>
                        <TableCell colSpan="5" align="center">
                            <Typography variant="h6">No transactions to display.</Typography>
                        </TableCell>
                    </TableRow>
                </TableBody>
              )
          }
          
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
