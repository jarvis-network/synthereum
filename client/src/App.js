import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { makeStyles } from "@material-ui/core/styles";
import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";
import Container from "@material-ui/core/Container";
import Grid from "@material-ui/core/Grid";

const useStyles = makeStyles(theme => ({
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
}));

export default function App() {
  const classes = useStyles();

  const context = useWeb3Context();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!context.active) {
      context.setFirstValidConnector(['MetaMask', 'Infura']);
    }
  }, [context]);

  useEffect(() => {
    if (context.active) {
      setLoading(false);
    }
  });

  if (!context.active && !context.error) {
    return (
      <Backdrop open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  } else if (context.error) {
    return <div>Error</div>
  } else {
    return (
      <div className="App">
        <Backdrop className={classes.backdrop} open={loading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Container maxWidth="sm">
          <Grid container spacing={2}>
            <Grid item xs={12}>
            </Grid>
          </Grid>
        </Container>
      </div>
    );
  }
}
