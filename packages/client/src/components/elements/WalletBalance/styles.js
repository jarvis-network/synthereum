import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
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
      borderBottom: 0,
      '&:last-of-type': {
        borderTop: '1px solid rgba(224, 224, 224, 1)'
      }
    },
    TableCellCollateral: {
      paddingTop: 0
    },
    TokenCell: theme.TokenCell,
    TokenIcon: theme.TokenIcon,
  }));

export default useStyles;