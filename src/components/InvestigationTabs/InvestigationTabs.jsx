import { useEffect, useId, useRef, useState } from 'react';
import EvidencePanel from '../EvidencePanel/EvidencePanel.jsx';
import EvidenceComparison from '../EvidenceComparison/EvidenceComparison.jsx';
import PrecedentPanel from '../PrecedentPanel/PrecedentPanel.jsx';
import NarrativePanel from '../NarrativePanel/NarrativePanel.jsx';
import './InvestigationTabs.css';

const TABS = [
  { key: 'evidence', label: 'Evidence' },
  { key: 'precedent', label: 'Precedent & narrative' },
];

/**
 * Replaces the old always-stacked EvidencePanel/EvidenceComparison/
 * PrecedentPanel/NarrativePanel column with 2 tabs, so only one pair is
 * on screen at a time. DecisionBanner stays a sibling above this
 * component in App.jsx, never inside a tab. (A third "Timing" tab was
 * removed per team review - pipeline latency isn't part of the
 * investigation a reviewer needs to see.)
 *
 * @param {{ investigation: import('../../types').InvestigationReport }} props
 */
export default function InvestigationTabs({ investigation }) {
  const uid = useId();
  const [activeTab, setActiveTab] = useState('evidence');
  const tabRefs = useRef({});

  useEffect(() => {
    setActiveTab('evidence');
  }, [investigation?.order_id]);

  function tabId(key) {
    return `${uid}-tab-${key}`;
  }

  function panelId(key) {
    return `${uid}-panel-${key}`;
  }

  // Roving-tabindex arrow nav: only the active tab is Tab-reachable
  // (tabIndex 0), so moving the "selected" tab via arrow keys must also
  // move actual DOM focus there — changing tabIndex alone does not pull
  // focus off the previously-focused button.
  function focusTab(key) {
    setActiveTab(key);
    tabRefs.current[key]?.focus();
  }

  function handleKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.key === activeTab);
    if (event.key === 'ArrowRight') focusTab(TABS[(index + 1) % TABS.length].key);
    else if (event.key === 'ArrowLeft') focusTab(TABS[(index - 1 + TABS.length) % TABS.length].key);
    else if (event.key === 'Home') focusTab(TABS[0].key);
    else if (event.key === 'End') focusTab(TABS[TABS.length - 1].key);
  }

  return (
    <div className="investigation-tabs">
      <div
        className="investigation-tabs__list"
        role="tablist"
        aria-label="Investigation detail"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              id={tabId(tab.key)}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={panelId(tab.key)}
              tabIndex={isActive ? 0 : -1}
              className={isActive ? 'investigation-tabs__tab is-active' : 'investigation-tabs__tab'}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId('evidence')}
        role="tabpanel"
        aria-labelledby={tabId('evidence')}
        hidden={activeTab !== 'evidence'}
        tabIndex={0}
        className="investigation-tabs__panel"
      >
        <div className="investigation-grid">
          <EvidencePanel investigation={investigation} />
          <EvidenceComparison investigation={investigation} />
        </div>
      </div>

      <div
        id={panelId('precedent')}
        role="tabpanel"
        aria-labelledby={tabId('precedent')}
        hidden={activeTab !== 'precedent'}
        tabIndex={0}
        className="investigation-tabs__panel"
      >
        <div className="investigation-grid">
          <PrecedentPanel investigation={investigation} />
          <NarrativePanel investigation={investigation} />
        </div>
      </div>
    </div>
  );
}
