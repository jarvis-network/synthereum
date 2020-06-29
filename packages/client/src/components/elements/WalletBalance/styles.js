import { makeStyles } from "@material-ui/core/styles";

const TokenInfo = {
  fontSize: 18,
  fontWeight: 400,
  marginTop: 20,
  border: '1px solid #eee',
  padding: 10
};

const useStyles = makeStyles(theme => ({
    Paper: {
      ...theme.overrides.MuiPaper.panel,
      fontFamily: 'Hind Vadodara'
    },
    TokenInfo,
    SynthToken: {
      ...TokenInfo,
    },
    TokenCell: theme.TokenCell,
    TokenIcon: theme.TokenIcon,
  }));

export default useStyles;