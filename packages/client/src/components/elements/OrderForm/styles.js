import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Paper: {
      backgroundColor: 'white',
      paddingTop: 20,
      paddingLeft: 40,
      paddingRight: 40,
      paddingBottom: 20,
      border: '1px solid #EBEBEB',
      borderRadius: 4,
      boxShadow: 'none'
    },
    ButtonRow: {
      display: 'flex',
      justifyContent: 'space-evenly',
      width: '100%'
    },
    ActionButton: {
      background: 'transparent',
      width: '100%',
      textTransform: 'none',
      fontSize: 18,
      color: '#000000',
  
    },
    OrderButton: {
      dropShadow: 'none',
      backgroundColor: '#94B0DA',
      color: 'white',
      textTransform: 'uppercase',
      fontSize: '1rem',
      borderRadius: '3px',
      padding: 10,
      fontFamily: 'Rubik',
      fontWeight: 500,
    }
  }));

  export default useStyles;