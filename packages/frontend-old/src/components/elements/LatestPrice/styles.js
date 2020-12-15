import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  Paper: {
    ...theme.overrides.MuiPaper.panel,
    paddding: 10,
  },
  StatHeader: {
    color: '#546e7a',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.08333em',
    textTransform: 'uppercase',
    marginBottom: '0.35em',
  },
}));

export default useStyles;
