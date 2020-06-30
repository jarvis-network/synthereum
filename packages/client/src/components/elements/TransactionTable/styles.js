import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Paper: {
      ...theme.overrides.MuiPaper.panel,
      fontFamily: 'Hind Vadodara'
    },
    InputAmount: {
      color: 'red'
    },
    OutputAmount: {
      color: 'green'
    }
  }));

export default useStyles;