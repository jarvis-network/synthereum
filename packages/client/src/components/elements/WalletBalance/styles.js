import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Grid: {
      backgroundColor: '#FBFBFF'
    },
    Container: {
      paddingTop: theme.spacing(4),
      paddingBottom: theme.spacing(2)
    },
    Paper: {
      ...theme.overrides.MuiPaper.panel
    },
    TableHead: {
      fontWeight: 500,
      fontSize: 16
    },
    TableRow: {
      fontSize: 18,
      fontWeight: 400,
      borderBottom: 0
    },
    TableCellCollateral: {
      paddingTop: 0
    },
    TokenCell: theme.TokenCell,
    TokenIcon: theme.TokenIcon,
  }));

export default useStyles;