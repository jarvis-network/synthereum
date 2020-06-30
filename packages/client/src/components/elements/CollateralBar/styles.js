import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
  top: {
    animationDuration: "550ms",
    position: "absolute",
    left: 0
  },
  bottom: {
    color: theme.palette.grey[theme.palette.type === "light" ? 200 : 700]
  }
}));

export default useStyles;
