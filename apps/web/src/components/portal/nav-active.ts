/**
 * Whether a sidebar link for `href` should be highlighted for the current
 * `pathname`.
 *
 * Exact matches are active, and so is anything nested under `href` (so a
 * future `/history/:id` detail route would still highlight "History"). A
 * bare `pathname.startsWith(href)` would get this wrong: `/dashboard` would
 * also match a hypothetical `/dashboardish` route, since one string is
 * simply a prefix of the other. Comparing against `${href}/` closes that
 * gap - a real nested route always has the separating slash, a
 * same-prefix-different-route never does.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
