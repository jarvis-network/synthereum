import React from "react";
import clsx from "clsx";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";
import Box from "@material-ui/core/Box";

import { useLocation } from "react-router-dom";

import { DashboardPages, SupportPages } from "../../../helpers/pages";
import { useWeb3Context } from "web3-react";

import useStyles from "./styles";

const Header = ({ open, handleDrawerOpen }) => {
  const context = useWeb3Context();
  const { account } = context;

  const classes = useStyles();
  const location = useLocation();
  let currentPage =
    DashboardPages.concat(SupportPages).find(
      page => page.link === location.pathname
    ) || {};

  return (
    <AppBar
      position="fixed"
      className={clsx(classes.appBar, {
        [classes.appBarShift]: open
      })}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={handleDrawerOpen}
          edge="start"
          className={clsx(classes.menuButton, {
            [classes.hide]: open
          })}
        >
          <MenuIcon />
        </IconButton>
        <div className={classes.HeaderContent}>
          <Typography variant="h6" noWrap>
            {currentPage.pageTitle}
          </Typography>
          <Typography variant="h2" className={classes.Logo}>
            Synthereum Wallet
          </Typography>
          <Box component="span" display="inline" className={classes.AddressSpan}>
            <Typography variant="h6" className={classes.Address}>
              {account.slice(0, 6) +
                "..." +
                account.slice(account.length - 4, account.length)}
            </Typography>
          </Box>
        </div>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
