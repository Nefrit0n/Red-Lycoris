import { CssBaseline, Container, Typography } from "@mui/material";

const App = () => {
  return (
    <>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Hello World
        </Typography>
        <Typography color="text.secondary">
          Lotus Warden frontend is ready.
        </Typography>
      </Container>
    </>
  );
};

export default App;
