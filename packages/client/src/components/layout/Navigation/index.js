import React from "react";

import Hidden from '@material-ui/core/Hidden';
import Drawer from "@material-ui/core/Drawer";
import Typography from "@material-ui/core/Typography";
import List from "@material-ui/core/List";
import Divider from "@material-ui/core/Divider";

import useStyles from "./styles";
import { useTheme } from '@material-ui/core/styles';


import { DashboardPages, SupportPages } from "../../../helpers/pages";

import NavItem from "./NavItem";

const Navigation = ({ window, handleDrawerToggle }) => {
  const classes = useStyles();
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const drawer = (
    <div>
      <div className={classes.toolbar}>
        <Typography variant="h2" className={classes.Logo}>
          Synthereum
        </Typography>
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
    </div>
  );
  const container = window !== undefined ? () => window().document.body : undefined;


  return (
    <nav className={classes.drawer}>
      {/* The implementation can be swapped with js to avoid SEO duplication of links. */}
      <Hidden smUp implementation="css">
        <Drawer
          container={container}
          variant="temporary"
          anchor={theme.direction === 'rtl' ? 'right' : 'left'}
          open={mobileOpen}
          onClose={handleDrawerToggle}
          classes={{
            paper: classes.drawerPaper,
          }}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile.
          }}
        >
          {drawer}
        </Drawer>
      </Hidden>
      <Hidden xsDown implementation="css">
        <Drawer
          classes={{
            paper: classes.drawerPaper,
          }}
          variant="permanent"
          open
        >
          {drawer}
        </Drawer>
      </Hidden>
    </nav>
  );
};

export default Navigation;
