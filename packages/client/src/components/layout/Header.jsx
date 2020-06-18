import React from "react";
import { NavLink } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Container from "@material-ui/core/Container";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";

import colors from "../../helpers/colors";

const useStyles = makeStyles(theme => ({
  root: {
    flexGrow: 1
  },
  appBar: {
    background: "#efefef",
    boxShadow: "none"
  },
  title: {
    flexGrow: 1,
    color: colors.black,
    fontFamily: "'Rubik', sans-serif"
  },
  toolbar: {
    padding: 0
  },
  button: {
    color: colors.black,
    textDecoration: "none",
    marginLeft: theme.spacing(4)
  }
}));

const Header = () => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.appBar}>
        <Container maxWidth="lg">
          <Toolbar className={classes.toolbar}>
            <Typography variant="h6" className={classes.title}>
              Synthereum Wallet
            </Typography>
            <NavLink to="/" className={classes.button} color="inherit">
              Order
            </NavLink>
            <NavLink to="/rates" className={classes.button} color="inherit">
              Rates
            </NavLink>
            <NavLink
              to="/transactions"
              className={classes.button}
              color="inherit"
            >
              Transactions
            </NavLink>
          </Toolbar>
        </Container>
      </AppBar>
    </div>
  );
};

export default Header;
