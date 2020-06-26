import React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';

import useStyles from "./styles";

function CollateralBar({ value }) {

    const classes = useStyles();

    return (
    <Box className={classes.CollateralBox}>
      <Box display="flex" justifyContent="space-between">
      <Box minWidth={35}>
        <Typography variant="body2" color="textSecondary">Your Collateral: {`${Math.round(value * 100)}%`}</Typography>
      </Box>
      <Box minWidth={35}>
        <Typography variant="body2" color="textSecondary">LP Collateral: {`${Math.round((1 - value) * 100)}%`}</Typography>
      </Box>
      </Box>
      <Box width="100%" mr={1}>
        <LinearProgress variant="determinate" value={value * 100} />
      </Box>
    </Box>
  );
}

CollateralBar.defaultProps = {
    value: 0
};

export default CollateralBar;