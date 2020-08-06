import { makeStyles } from '@material-ui/core/styles';

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
  appBar: {
    backgroundColor: '#2541B2',
    boxShadow: 'none',
    [theme.breakpoints.up('sm')]: {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: drawerWidth,
    },
  },
  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  AddressSpan: {
    backgroundColor: '#03256C',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 50,
    border: '1px solid #94B0DA',
  },
  Address: {
    color: '#ffffff',
    fontSize: 14,
  },
  HeaderContent: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
  },
  PageTitle: {
    fontFamily: 'Hind Vadodara',
  },
}));

export default useStyles;
