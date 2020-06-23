import { createMuiTheme } from '@material-ui/core/styles';

const theme = createMuiTheme({
    TokenIcon: {
      marginRight: 10,
      width: 24,
      height: 24
    },
    TokenCell: {
      display: 'flex',
      alignItems: 'center'
    },
    overrides: {
      MuiDrawer: {
        paper: {
          position: 'absolute'
        },
        paperAnchorLeft: {
          left: 'auto'
        }
      },
      MuiPaper: {
        panel: {
          backgroundColor: 'white',
          paddingTop: 20,
          paddingLeft: 40,
          paddingRight: 40,
          paddingBottom: 20,
          border: '1px solid #EBEBEB',
          borderRadius: 4,
          boxShadow: 'none',
          fontFamily: 'Roboto'
        }
      },
      MuiTableCell: {
        root: {
          fontSize: 18,
          border: 'none',
          paddingLeft: 0,
          paddingRight: 0,
        },
        head: {
          paddingLeft: 0,
          paddingRight: 0
        }
      },
      MuiSelect: {
        root: {
          fontWeight: "bold"
        }
      }
    },
  });


  export default theme;