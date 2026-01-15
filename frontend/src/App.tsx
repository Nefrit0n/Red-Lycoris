import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboards from "./pages/Dashboards";
import Findings from "./pages/Findings";
import Filters from "./pages/Filters";
import Products from "./pages/Products";

const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Dashboards />} />
        <Route path="/products" element={<Products />} />
        <Route path="/findings" element={<Findings />} />
        <Route path="/filters" element={<Filters />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
