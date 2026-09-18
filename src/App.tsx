import { Router } from './router';
import BaseLayout from './components/BaseLayout';
import './styles/global.css';

export default function App() {
  return (
    <Router>
      {(props) => <BaseLayout>{props.children}</BaseLayout>}
    </Router>
  );
}
