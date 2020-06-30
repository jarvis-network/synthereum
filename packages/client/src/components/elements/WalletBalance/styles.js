import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Paper: {
      ...theme.overrides.MuiPaper.panel,
      fontFamily: 'Hind Vadodara',
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0
    },
    CardHeader: {
      borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
      '& span': {
        fontSize: '16px',
        fontWeight: 500
      }
    },
    CardContent: {
      padding: 0,
      '&:last-child': {
        paddingBottom: 0
      },
    },
    BalanceCell: {
      fontSize: '28px',
      fontSize: 28
    },
    TokenIconCell: {
      '& img': {
        verticalAlign: 'middle'
      }
    },
    TokenCell: theme.TokenCell,
    TokenIcon: theme.TokenIcon,
  }));

export default useStyles;