import { makeStyles } from "@material-ui/core/styles";

const ActionButton = {
  background: 'transparent',
  width: '100%',
  textTransform: 'uppercase',
  fontSize: 22,
  color: '#94B0DA',
  '&:hover': {
    backgroundColor: 'transparent',
    color: '#2541B2'
  }
};

const useStyles = makeStyles(theme => ({
    TableRow: theme.overrides.TableRow,
    Paper: {
      ...theme.overrides.MuiPaper.panel,
    },
    FeeTable: {
      ...theme.overrides.MuiPaper.panel,
      paddingLeft: 20,
      paddingRight: 20,
      marginBottom: 20
    },
    ButtonRow: {
      display: 'flex',
      justifyContent: 'space-evenly',
      width: '100%',
      borderBottom: '2px solid #03256c'
    },
    ActionButton,
    ActionButtonActive: {
      ...ActionButton,
      color: '#03256C'
    },
    OrderButton: {
      dropShadow: 'none',
      backgroundColor: '#2541B2',
      color: 'white',
      textTransform: 'uppercase',
      fontSize: '1rem',
      borderRadius: '3px',
      padding: 10,
      fontFamily: 'Rubik',
      fontWeight: 500,
      '&:hover': {
        backgroundColor: '#03256C'
      }
    }
  }));

  export default useStyles;