import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles(theme => ({
    Paper: theme.overrides.MuiPaper.panel
}));

export default useStyles;