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
import useStyles from "./styles";
import { useWeb3Context } from "web3-react";
import * as icons from "../../../assets/icons";
import Loader from "../Loader";

const TransactionTable = ({ assets }) => {
  const classes = useStyles();
  const context = useWeb3Context();
  const { fromWei } = context.library.utils;
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  // TODO: should only render component once contracts are ready
  const contractsReady = assets[0].contract ? true : false;

  async function getEvents() {
    // TODO: subtract 1,000,000 from web3.eth.getBlockNumber(), set floor to 0
    const params = {
      filter: { sender: context.account },
      fromBlock: 0,
      toBlock: "latest"
    };

    try {
      const response = await Promise.all(
        assets.map(a => a.contract.getPastEvents("allEvents", params))
      );
      const assetEvents = response.map((events, index) => {
        return events.map(ev => {
          if (ev.event.indexOf("Mint") > -1) {
            ev.toAsset = assets[index].symbol;
            ev.fromAsset = "DAI";
          } else if (ev.event.indexOf("Redeem") > -1) {
            ev.toAsset = "DAI";
            ev.fromAsset = assets[index].symbol;
          } else if (ev.event.indexOf("Exchange") > -1) {
            ev.fromAsset = assets[index].symbol;
          }
          return ev;
        });
      });
      const allEvents = [].concat.apply([], assetEvents);
      console.log(allEvents);
      // setEvents(allEvents);
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

  console.log(events[0]);

  return (
    <Paper className={classes.Paper}>
      {loading ? (
        <Loader />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              {/* <TableCell>Type</TableCell> */}
              <TableCell>Name</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
            </TableRow>
          </TableHead>

          {
              events.length > 0 ? (
                <TableBody>
                    {events.map((ev, index) => (
                    <TableRow key={index}>
                        <TableCell>{ev.id}</TableCell>
                        {/* <TableCell>
                                            {ev.event.replace("Requested","").replace("Approved","").replace("Rejected","")}
                                        </TableCell> */}
                        <TableCell>{ev.event}</TableCell>
                        <TableCell>
                        {moment(parseInt(ev.returnValues.timestamp) * 1000).format(
                            "M/D/YY h:ma"
                        )}
                        </TableCell>
                        {ev.event === "MintRequested" ||
                        ev.event === "RedeemRequested" ? (
                        <TableCell className={classes.InputAmount}>
                            <Box component="div" className={classes.AssetCell}>
                            {`-${fromWei(
                                ev.returnValues[
                                ev.event === "RedeemRequested"
                                    ? "numTokens"
                                    : "collateralAmount"
                                ]
                            )}`}
                            <img
                                alt={ev.fromAsset}
                                width="28"
                                height="28"
                                src={icons[ev.fromAsset]}
                            />
                            </Box>
                        </TableCell>
                        ) : (
                        <TableCell></TableCell>
                        )}
                        {ev.event === "MintRequested" ||
                        ev.event === "RedeemRequested" ? (
                        <TableCell className={classes.OutputAmount}>
                            <Box component="div" className={classes.AssetCell}>
                            {`+${fromWei(
                                ev.returnValues[
                                ev.event === "RedeemRequested"
                                    ? "collateralAmount"
                                    : "numTokens"
                                ]
                            )}`}
                            <img
                                alt={ev.toAsset}
                                width="28"
                                height="28"
                                src={icons[ev.toAsset]}
                            />
                            </Box>
                        </TableCell>
                        ) : (
                        <TableCell></TableCell>
                        )}
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
