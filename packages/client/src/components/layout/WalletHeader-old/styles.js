import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    AppBar: {
        background: "transparent"
    },
    Toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    Logo: {
        color: "#000000",
        fontFamily: "Rubik",
        fontSize: 22
    },
    AddressSpan: {
        backgroundColor: '#ffffff',
        paddingTop: 4,
        paddingBottom: 4,
        paddingLeft: 12,
        paddingRight: 12,
        borderRadius: 50,
        border: '1px solid #EBEBEB',
    },
    Address: {
        color: '#000000',
        fontSize: 14
    }
  }));

export default useStyles;