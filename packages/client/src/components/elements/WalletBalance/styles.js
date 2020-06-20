import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Grid: {
      backgroundColor: '#FBFBFF'
    },
    Container: {
      paddingTop: theme.spacing(4),
      paddingBottom: theme.spacing(2)
    },
    Paper: {
      backgroundColor: 'white',
      paddingTop: 0,
      paddingLeft: 20,
      paddingRight: 20,
      border: '1px solid #EBEBEB',
      borderRadius: 4,
      boxShadow: 'none'
    },
    TableHead: {
      fontWeight: 500,
      fontSize: 16
    },
    TableRow: {
      fontSize: 18,
      fontWeight: 400,
    },
    TokenCell: {
      display: 'flex',
      alignItems: 'center'
    },
    TokenIcon: {
      marginRight: 10,
      width: 24,
      height: 24
    }
  }));

export default useStyles;