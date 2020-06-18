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
  button: {
    color: colors.black,
    textDecoration: "none",

    marginLeft: 15
  }
}));

const Header = () => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.appBar}>
        <Container maxWidth="lg">
          <Toolbar>
            <Typography variant="h6" className={classes.title}>
              Jarvis Wallet
            </Typography>
            <NavLink to="/" className={classes.button} color="inherit">
              Order
            </NavLink>
            <NavLink to="/buy" className={classes.button} color="inherit">
              Buy
            </NavLink>
            <NavLink to="/sell" className={classes.button} color="inherit">
              Sell
            </NavLink>
            <NavLink to="/exchange" className={classes.button} color="inherit">
              Exchange
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
