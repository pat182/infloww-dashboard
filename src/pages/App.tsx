import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "../MainLayout";
import Dashboard from "./Dashboard";


export default function App() {

 return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/creators" element={<h1>Creators</h1>} />
          <Route path="/chatters" element={<h1>Chatters</h1>} />
          <Route path="/fans" element={<h1>Fans</h1>} />
          <Route path="/promotions" element={<h1>Promotions</h1>} />
          <Route path="/revenue" element={<h1>Revenue</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}


