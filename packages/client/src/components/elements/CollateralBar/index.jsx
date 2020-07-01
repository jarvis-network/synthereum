import React from "react";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import Tooltip from "@material-ui/core/Tooltip";

import Box from "@material-ui/core/Box";

import useStyles from "./styles";

const Progress = React.forwardRef(function Progress(props, ref) {
  //  Spread the props to the underlying DOM element.
  return <CircularProgress {...props} ref={ref} />;
});

function CollateralBar({ value, total }) {
  const classes = useStyles();

  const progress = (value / (total != 0 ? total : 1)) * 100;

  return (
    <Box position="relative" display="inline-flex">
      <Tooltip title="LP Collateral">
        <Progress
          className={classes.bottom}
          size={56}
          thickness={4}
          variant="determinate"
          value={100}
        />
      </Tooltip>
      <Tooltip title="User Collateral">
        <Progress
          size={56}
          thickness={4}
          variant="static"
          value={progress}
          className={classes.top}
        />
      </Tooltip>
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
        >{`${Math.round(progress)}%`}</Typography>
      </Box>
    </Box>
  );
}

CollateralBar.defaultProps = {
  total: 110
};

export default CollateralBar;
