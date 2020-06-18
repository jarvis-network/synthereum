import React from "react";
import { makeStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import MenuIcon from '@material-ui/icons/Menu';

import colors from "../../helpers/colors";

const useStyles = makeStyles((theme) => ({
    root: {
      flexGrow: 1,      
    },
    appBar: {
        background: '#efefef',
        boxShadow: 'none'
    },
    title: {
      flexGrow: 1,
      color: colors.black,
      fontFamily: "'Rubik', sans-serif"
    },
    button: {
        color: colors.aqua
    }
  }));


const Header = ({ }) => {


    const classes = useStyles();

  return (
    <div className={classes.root}>
      <AppBar position="static" className={classes.appBar}>
        <Toolbar>
          <Typography variant="h6" className={classes.title}>
            Jarvis Wallet
          </Typography>
          <Button className={classes.button} color="inherit">Login</Button>
        </Toolbar>
      </AppBar>
    </div>
  );

}

export default Header;