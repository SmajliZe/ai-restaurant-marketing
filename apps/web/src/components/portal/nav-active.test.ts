import { describe, expect, it } from 'vitest';

import { isNavItemActive } from './nav-active';

describe('isNavItemActive', () => {
  it('is active on an exact match', () => {
    expect(isNavItemActive('/dashboard', '/dashboard')).toBe(true);
  });

  it('is active on a nested route', () => {
    expect(isNavItemActive('/history/abc-123', '/history')).toBe(true);
  });

  it('is not active on an unrelated route', () => {
    expect(isNavItemActive('/calendar', '/dashboard')).toBe(false);
  });

  it('is not active when another route merely shares the same prefix', () => {
    // Without the trailing-slash check, "/dashboard".startsWith("/dashboard")
    // would also be true for a route like "/dashboardish".
    expect(isNavItemActive('/dashboardish', '/dashboard')).toBe(false);
  });

  it('is not active on the root path for a nested link', () => {
    expect(isNavItemActive('/', '/dashboard')).toBe(false);
  });
});
