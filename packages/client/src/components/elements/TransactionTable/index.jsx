import React, { useState, useEffect } from "react";
import moment from "moment";
import { Paper, Table, TableHead, TableBody, TableRow, TableCell, TableFooter } from "@material-ui/core";
import useStyles from "./styles";
import { useWeb3Context } from "web3-react";

const TransactionTable = ({ assets }) => {

    const classes = useStyles();
    const context = useWeb3Context();
    const { fromWei } = context.library.utils;
    const [events, setEvents] = useState([]);

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

            const response = await Promise.all(assets.map(a => a.contract.getPastEvents("allEvents", params)));
            console.log(response);
            setEvents([].concat.apply([], response));

        } catch(err) {
            console.error(err);
        }

    }

    useEffect(() => {
        if (contractsReady) {
            getEvents();
        }
    }, [contractsReady]);

    console.log(events[0]);
    // TODO: loading + empty state

    return (
        <Paper className={classes.Paper}>
            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>To</TableCell>
                        <TableCell>From</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {
                        events.map((ev, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    {ev.id}
                                </TableCell>
                                <TableCell>
                                    {ev.event.replace("Requested","").replace("Approved","").replace("Rejected","")}
                                </TableCell>
                                <TableCell>
                                    {ev.event}
                                </TableCell>
                                <TableCell>
                                    {moment(parseInt(ev.returnValues.timestamp) * 1000).format("M/D/YY h:ma")}
                                </TableCell>
                                {
                                    (ev.event === "MintRequested" || ev.event === "RedeemRequested") ? (
                                        <TableCell className={classes.InputAmount}>
                                            {`-${fromWei(ev.returnValues[ev.event === "RedeemRequested" ?  "numTokens" : "collateralAmount"])}`}
                                        </TableCell>
                                    ) : (
                                        <TableCell></TableCell>
                                    )
                                }
                                {
                                    (ev.event === "MintRequested" || ev.event === "RedeemRequested") ? (
                                        <TableCell className={classes.OutputAmount}>
                                            {`+${fromWei(ev.returnValues[ev.event === "RedeemRequested" ?  "collateralAmount" : "numTokens"])}`}
                                        </TableCell>
                                    ) : (
                                        <TableCell></TableCell>
                                    )
                                }
                            </TableRow>
                        ))
                    }
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan="6" align="center">
                            1
                        </TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </Paper>
    )

};

export default TransactionTable;