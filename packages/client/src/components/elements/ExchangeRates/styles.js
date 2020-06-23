import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    TokenIcon: theme.TokenIcon,
    TokenCell: theme.TokenCell,
    Paper: {
      ...theme.overrides.MuiPaper.panel
    },
  }));

export default useStyles;