import { createMuiTheme } from '@material-ui/core/styles';

const theme = createMuiTheme({
    TokenIcon: {
      marginRight: 10,
      width: 24,
      height: 24
    },
    TokenCell: {
      display: 'flex',
      alignItems: 'center',
      fontWeight: 500
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
      MuiTableRow: {
        root: {
          borderBottom: '1px solid rgba(224, 224, 224, 1)'
        }
      },
      MuiTableCell: {
        root: {
          fontSize: 18,
          border: 'none',
          paddingLeft: 0,
          paddingRight: 0,
          borderBottom: 'none'
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