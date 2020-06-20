import React from "react";
import { useWeb3Context } from "web3-react";

import Grid from "@material-ui/core/Grid";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Box from "@material-ui/core/Box";
import Typography from "@material-ui/core/Typography";

import useStyles from "./styles";

const WalletHeader = ({}) => {
  const classes = useStyles();
  const context = useWeb3Context();
  const { account } = context;

  return (
    <Grid item md={12}>
      <AppBar position="static" className={classes.AppBar}>
        <Toolbar className={classes.Toolbar}>
          <Typography variant="h2" className={classes.Logo}>
            Synthereum Wallet
          </Typography>
          <Box
            component="span"
            display="inline"
            className={classes.AddressSpan}
          >
            <Typography variant="h6" className={classes.Address}>
              {account.slice(0, 6) +
                "..." +
                account.slice(account.length - 4, account.length)}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
    </Grid>
  );
};

export default WalletHeader;
