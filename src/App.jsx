import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./components/Landing";
import Visualizer from "./components/Visualizer";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/visualizer" element={<Visualizer />} />
      </Routes>
    </BrowserRouter>
  );
}