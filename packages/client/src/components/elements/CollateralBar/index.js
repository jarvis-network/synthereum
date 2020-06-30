import React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';

import Box from '@material-ui/core/Box';

import useStyles from "./styles";

function CollateralBar({ value, total }) {

    const classes = useStyles();


    return (
      <Box position="relative" display="inline-flex">
      <CircularProgress size={56} thickness={4} variant="static" value={value / total * 100} />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography variant="caption" component="div" color="textSecondary">{`${Math.round(
          value / total * 100,
        )}%`}</Typography>
      </Box>
    </Box>
    )

  //   return (
  //   <Box className={classes.CollateralBox} marginTop={2}>
  //     <Box display="flex" justifyContent="space-between">
  //     <Box minWidth={35}>
  //       <Typography variant="body2" color="textSecondary">Your Collateral: {value}/{total}</Typography>
  //     </Box>
  //     <Box minWidth={35}>
  //       <Typography variant="body2" color="textSecondary">LP Collateral: {total-value}/{total}</Typography>
  //     </Box>
  //     </Box>
  //     <Box width="100%" mr={1}>
  //       <LinearProgress variant="determinate" value={value/total * 100} />
  //     </Box>
  //   </Box>
  // );
}

CollateralBar.defaultProps = {
  value: 100,
  total: 110
};

export default CollateralBar;