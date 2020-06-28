import { makeStyles } from "@material-ui/core/styles";

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
  drawer: {
    [theme.breakpoints.up('sm')]: {
      width: drawerWidth,
      flexShrink: 0,
    },
  },
  
  menuButton: {
    marginRight: theme.spacing(2),
    [theme.breakpoints.up('sm')]: {
      display: 'none',
    },
  },
  // necessary for content to be below app bar
  toolbar: {
    ...theme.mixins.toolbar,
    alignItems: 'center',
    display: 'flex',
    paddingLeft: 16
  },
  drawerPaper: {
    width: drawerWidth,
  },
  NavLink: {
    textDecoration: 'none',
    color: '#000000',
    fontWeight: 'bold'
  },
  Logo: {
    color: "#03256C",
    fontFamily: "Rubik",
    fontSize: 22,
    fontWeight: "bold"
  }
}));

export default useStyles;