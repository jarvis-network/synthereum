import React from "react";

import clsx from "clsx";

import IconButton from "@material-ui/core/IconButton";

import Drawer from "@material-ui/core/Drawer";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";

import useStyles from "./styles";

import { DashboardPages, SupportPages } from "../../../helpers/pages";

import NavItem from "./NavItem";

const Navigation = ({ open, handleDrawerClose }) => {
  const classes = useStyles();

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
          <ChevronLeftIcon />
        </IconButton>
      </div>
      <Divider />
      <List>
        {DashboardPages.map(page => (
          <NavItem key={page.title} page={page} />
        ))}
      </List>
      <Divider />
      <List>
        {SupportPages.map(page => (
          <NavItem key={page.title} page={page} />
        ))}
      </List>
    </Drawer>
  );
};

export default Navigation;
