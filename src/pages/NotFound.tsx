import { onSettled } from 'solid-js';
import Section from '../components/Section';

export default function NotFound() {
  onSettled(() => {
    document.title = 'Hari Pahwandi | Not Found';
  });

  return (
    <Section title="404" description="Page not found.">
      <a href="/" class="nav-link">
        Back home
      </a>
    </Section>
  );
}
