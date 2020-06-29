import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Paper: {
        ...theme.overrides.MuiPaper.panel,
        paddding: 10
    }
}));

export default useStyles;