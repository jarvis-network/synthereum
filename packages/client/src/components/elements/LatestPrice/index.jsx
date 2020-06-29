import React from "react";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";

import useStyles from "./style";

const LatestPrice = ({ price }) => {

    const classes = useStyles();

    return (
        <Paper className={classes.Paper}>
        <Typography variant="h6" noWrap>
          Latest Price
        </Typography>
        <Typography variant="h4" noWrap>
          {price ? `$${price}` : "Closed"}
        </Typography>
      </Paper>
    )
};

export default LatestPrice;