import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from '../context/AppContext';
import Home from '../pages/Home';
import Explore from '../pages/Explore';
import Forums from '../pages/Forums';
import Streaming from '../pages/Streaming';
import Login from '../pages/Login';
import ResetPassword from '../pages/ResetPassword';
import Dashboard from '../pages/Dashboard';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"               element={<Home />} />
          <Route path="/explore"        element={<Explore />} />
          <Route path="/forums"         element={<Forums />} />
          <Route path="/streaming"      element={<Streaming />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/browse"         element={<Dashboard />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
