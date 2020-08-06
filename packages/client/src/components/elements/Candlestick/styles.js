import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  Paper: {
    ...theme.overrides.MuiPaper.panel,
    paddingRight: 0,
    paddingLeft: 20,
    paddingTop: 0,
    paddingBottom: 20,
  },
}));

export default useStyles;
