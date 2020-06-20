import React from "react";

import clsx from "clsx";
import { useTheme } from "@material-ui/core/styles";

import IconButton from "@material-ui/core/IconButton";

import Drawer from "@material-ui/core/Drawer";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";

import useStyles from "./styles";

import { DashboardPages, SupportPages } from "../../../helpers/pages";

import NavItem from "./NavItem";

const Navigation = ({ open, handleDrawerClose }) => {

    const classes = useStyles();
    const theme = useTheme();

    return (
        <Drawer
          variant="permanent"
          className={clsx(classes.drawer, {
            [classes.drawerOpen]: open,
            [classes.drawerClose]: !open
          })}
          classes={{
            paper: clsx({
              [classes.drawerOpen]: open,
              [classes.drawerClose]: !open
            })
          }}
        >
          <div className={classes.toolbar}>
            <IconButton onClick={handleDrawerClose}>
              {theme.direction === "rtl" ? (
                <ChevronRightIcon />
              ) : (
                <ChevronLeftIcon />
              )}
            </IconButton>
          </div>
          <List>
            {DashboardPages.map(page => (<NavItem page={page} />))}
          </List>
          <Divider />
          <List>
            {SupportPages.map(page => (<NavItem page={page} />))}
          </List>
        </Drawer>
    )

};

export default Navigation;