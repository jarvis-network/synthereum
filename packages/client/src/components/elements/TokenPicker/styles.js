import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    TokenIcon: theme.TokenIcon,
    TokenCell: {
        ...theme.TokenCell,
        padding: "10px 10px",
        margin: "0px 10px",
        borderBottom: "1px solid rgba(224, 224, 224, 1)"
    },
    MuiSelect: theme.MuiSelect
  }));

  export default useStyles;