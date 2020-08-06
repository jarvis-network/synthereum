import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(theme => ({
  TableRow: theme.overrides.TableRow,
  Paper: {
    ...theme.overrides.MuiPaper.panel,
  },
  FeeTable: {
    ...theme.overrides.MuiPaper.panel,
    paddingLeft: 20,
    paddingRight: 20,
    marginBottom: 20,
  },
  FormGroup: {
    // border: '1px solid #DCEDFF',
    // padding: '1rem',
    // borderRadius: 20,
    //marginBottom: 10
  },
  OrderButton: {
    dropShadow: 'none',
    backgroundColor: '#2541B2',
    color: 'white',
    textTransform: 'uppercase',
    fontSize: '1rem',
    borderRadius: '3px',
    padding: 10,
    fontFamily: 'Rubik',
    fontWeight: 500,
    marginTop: 10,
    '&:hover': {
      backgroundColor: '#03256C',
    },
  },
  ErrorAlert: {
    marginTop: 10,
  },
}));

export default useStyles;
