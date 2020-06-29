import { makeStyles } from "@material-ui/core/styles";

const TableRow = {
  fontSize: 18,
  fontWeight: 400,
  borderBottom: 0,
  '&:last-of-type': {
    borderTop: '1px solid rgba(224, 224, 224, 1)'
  }
};

const useStyles = makeStyles(theme => ({
    Paper: {
      ...theme.overrides.MuiPaper.panel
    },
    TableHead: {
      fontWeight: 500,
      fontSize: 16
    },
    TableRow: TableRow,
    TableRowBlue: {
      ...TableRow,
      backgroundColor: "#DCEDFF",
      paddingLeft: 10,
      paddingRight: 10
    },
    TableCellCollateral: {
      paddingTop: 0
    },
    TokenCell: theme.TokenCell,
    TokenIcon: theme.TokenIcon,
  }));

export default useStyles;