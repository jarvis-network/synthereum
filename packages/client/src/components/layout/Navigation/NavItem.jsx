import React from "react";
import { NavLink } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";

import useStyles from "./styles";

const NavItem = ({ page }) => {

    const classes = useStyles();

    return (
        <NavLink key={page.title} to={page.link} className={classes.NavLink}>
            <ListItem button key={page}>
                <ListItemIcon>
                    {page.icon}
                </ListItemIcon>
                <ListItemText primary={page.title} />
            </ListItem>
        </NavLink>
    )

}

export default NavItem;