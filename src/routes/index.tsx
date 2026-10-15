import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <main>
      <img src="/brand/grd-logo.svg" alt="Global Resources Direct" width="316" />
      <h1>GRD Dashboard</h1>
      <p>Shipment monitoring is coming soon.</p>
      <p>The dashboard is being prepared. Shipment information is not yet available.</p>
    </main>
  );
}
