/**
 * Accessibility Tests for Design System Components
 *
 * Basic accessibility tests for components.
 * Note: For full WCAG compliance testing, use axe-core in Storybook or Playwright.
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider, Button as MuiButton } from '@mui/material';
import { darkTheme } from '../theme';
import { StatusBadge } from '../components/StatusBadge';

// Helper to render with theme
const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={darkTheme}>
      {component}
    </ThemeProvider>
  );
};

// Cleanup after each test
beforeEach(() => {
  cleanup();
});

describe('MUI Button Accessibility (baseline)', () => {
  it('should have button role', () => {
    renderWithTheme(<MuiButton>Click me</MuiButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should have accessible name', () => {
    renderWithTheme(<MuiButton>Submit Form</MuiButton>);
    expect(screen.getByRole('button', { name: 'Submit Form' })).toBeInTheDocument();
  });

  it('should indicate disabled state', () => {
    renderWithTheme(<MuiButton disabled>Disabled Button</MuiButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should be focusable', () => {
    renderWithTheme(<MuiButton>Focusable</MuiButton>);
    const button = screen.getByRole('button');
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});

describe('StatusBadge Accessibility', () => {
  it('should have correct aria-label for critical severity', () => {
    renderWithTheme(<StatusBadge type="severity" value="critical" />);
    const badge = screen.getByLabelText('severity: Critical');
    expect(badge).toBeInTheDocument();
  });

  it('should have correct aria-label for high severity', () => {
    renderWithTheme(<StatusBadge type="severity" value="high" />);
    const badge = screen.getByLabelText('severity: High');
    expect(badge).toBeInTheDocument();
  });

  it('should have correct aria-label for mitigated status', () => {
    renderWithTheme(<StatusBadge type="status" value="mitigated" />);
    const badge = screen.getByLabelText('status: Mitigated');
    expect(badge).toBeInTheDocument();
  });

  it('should support custom aria-label', () => {
    renderWithTheme(
      <StatusBadge
        type="severity"
        value="medium"
        aria-label="Custom label for badge"
      />
    );
    const badge = screen.getByLabelText('Custom label for badge');
    expect(badge).toBeInTheDocument();
  });

  it('should mark icon as decorative', () => {
    renderWithTheme(<StatusBadge type="severity" value="low" showIcon />);
    const icon = screen.getByTestId('CheckCircleOutlineIcon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('should have status role', () => {
    renderWithTheme(<StatusBadge type="risk" value="high" />);
    const badge = screen.getByLabelText('risk: High Risk');
    expect(badge).toHaveAttribute('role', 'status');
  });
});

describe('Design System Theme', () => {
  it('should render components with dark theme', () => {
    renderWithTheme(
      <div data-testid="themed-container">
        <StatusBadge type="severity" value="info" />
      </div>
    );
    expect(screen.getByTestId('themed-container')).toBeInTheDocument();
  });
});
