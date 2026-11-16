import { Route, Routes } from 'react-router-dom';
import Track from './pages/Track.jsx';
import Counter from './pages/Counter.jsx';
import Admin from './pages/Admin.jsx';
import Poster from './pages/Poster.jsx';
import Landing from './pages/Landing.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/s/:slug" element={<Track />} />
      <Route path="/counter" element={<Counter />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/poster/:slug" element={<Poster />} />
      <Route path="*" element={<Landing />} />
    </Routes>
  );
}
