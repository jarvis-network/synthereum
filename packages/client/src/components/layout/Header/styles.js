import { makeStyles } from "@material-ui/core/styles";

const drawerWidth = 240;

const useStyles = makeStyles(theme => ({
  appBar: {
    backgroundColor: '#2541B2',
    zIndex: theme.zIndex.drawer + 1,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.leavingScreen
    })
  },
  appBarShift: {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen
    })
  },
  menuButton: {
    marginRight: 36
  },
  hide: {
    display: "none"
  },
  Logo: {
    color: "#ffffff",
    fontFamily: "Rubik",
    fontSize: 22
  },
  AddressSpan: {
    backgroundColor: "#03256C",
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 12,
    paddingRight: 12,
    borderRadius: 50,
    border: "1px solid #94B0DA"
  },
  Address: {
    color: "#ffffff",
    fontSize: 14
  },
  HeaderContent: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between'
  }
}));

export default useStyles;
