import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import Explore from '../pages/Explore';
import Forums from '../pages/Forums';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/forums" element={<Forums />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
