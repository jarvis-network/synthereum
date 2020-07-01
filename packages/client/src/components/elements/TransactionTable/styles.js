import { makeStyles } from "@material-ui/core/styles";

const AssetCell = {
  display: 'flex',
  alignItems: 'center',
  '& img': {
    marginRight: 8
  }
};

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
    },
    AssetCell
  }));

export default useStyles;