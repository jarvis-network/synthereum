import React from "react";

import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import Container from "@material-ui/core/Container";

import useStyles from "./style";

const Liquidity = () => {

    const classes = useStyles();

    return (
        <Container>
          <Grid container spacing={4} justify="space-around">
            <Grid item md={6}>
              <Paper className={classes.Paper}>
                Collateralization
              </Paper>
            </Grid>
            <Grid item md={6}>
            <Paper className={classes.Paper}>
                Liquidity
              </Paper>
            </Grid>
          </Grid>
        </Container>
    )
};

export default Liquidity;