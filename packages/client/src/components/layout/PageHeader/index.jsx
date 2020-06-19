import React from "react";

import clsx from "clsx";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";

import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";

import { useLocation } from "react-router-dom";

import { DashboardPages } from "../../../helpers/pages";

import useStyles from "./styles";

const PageHeader = ({ open, handleDrawerOpen }) => {

    const location = useLocation();
    let currentPage = location.pathname;

    const classes = useStyles();
    

    return (

        <AppBar
          position="absolute"
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
            <Typography variant="h6" noWrap>
              {(DashboardPages.find(page => page.link === currentPage) || {}).title || '404'}
            </Typography>
          </Toolbar>
        </AppBar>

    )
}

export default PageHeader;