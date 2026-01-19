import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#7aa2f7",
      light: "#9dbbff",
      dark: "#4c7bd9",
    },
    secondary: {
      main: "#9d7cd8",
      light: "#b89ce6",
      dark: "#7a5bb8",
    },
    background: {
      default: "#0f1115",
      paper: "#151922",
    },
    text: {
      primary: "#f5f7ff",
      secondary: "#a5adba",
    },
    divider: "#24283b",
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  },
});

export default theme;
