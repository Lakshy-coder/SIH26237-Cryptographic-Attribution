import { useState, useEffect } from 'react';
import { Nav, type Page } from './components/Nav';
import { OverviewPage } from './pages/OverviewPage';
import { SenderPage } from './pages/SenderPage';
import { RecipientPage } from './pages/RecipientPage';
import { InvestigatorPage } from './pages/InvestigatorPage';
import { SystemPage } from './pages/SystemPage';
import { getSystemStatus } from './api/system';

function App() {
  const [page, setPage] = useState<Page>('overview');
  const [systemAlive, setSystemAlive] = useState(false);

  useEffect(() => {
    getSystemStatus()
      .then(s => setSystemAlive(s.backend && s.validators.some(v => v.alive)))
      .catch(() => setSystemAlive(false));
  }, [page]);

  return (
    <div className="min-h-screen bg-canvas">
      <Nav current={page} onNavigate={setPage} systemAlive={systemAlive} />
      <main>
        {page === 'overview'     && <OverviewPage onNavigate={p => setPage(p as Page)} />}
        {page === 'sender'       && <SenderPage />}
        {page === 'recipient'    && <RecipientPage />}
        {page === 'investigator' && <InvestigatorPage />}
        {page === 'system'       && <SystemPage />}
      </main>
    </div>
  );
}

export default App;
