import React from "react";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";

import Box from "@material-ui/core/Box";

import useStyles from "./styles";

function CollateralBar({ value, total }) {
  const classes = useStyles();

  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress
        size={56}
        thickness={4}
        variant="determinate"
        value={100}
        className={classes.bottom}
      />
      <CircularProgress
        size={56}
        thickness={4}
        variant="static"
        value={(value / total) * 100}
        className={classes.top}
      />
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
        <Typography
          variant="caption"
          component="div"
          color="textSecondary"
        >{`${Math.round((value / total) * 100)}%`}</Typography>
      </Box>
    </Box>
  );
}

CollateralBar.defaultProps = {
  total: 110
};

export default CollateralBar;
