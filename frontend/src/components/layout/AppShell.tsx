import React from 'react';
import TabBar from './TabBar';

interface AppShellProps {
  children: React.ReactNode;
  /** Screens that own their own full-height layout (e.g. a sheet) can hide the tabs. */
  hideTabs?: boolean;
}

/**
 * The frame every signed-in screen sits in: a fixed-height column with a
 * scrolling middle and the tab bar pinned underneath. Using 100dvh (via
 * .app-shell) rather than 100vh is what keeps the tabs on screen when
 * Safari's address bar collapses.
 */
const AppShell: React.FC<AppShellProps> = ({ children, hideTabs }) => (
  <div className="app-shell bg-dark-600">
    <main className="app-scroll safe-top">{children}</main>
    {!hideTabs && <TabBar />}
  </div>
);

export default AppShell;
