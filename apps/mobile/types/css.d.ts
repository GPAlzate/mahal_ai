// CSS imports are handled by Metro/web bundlers, not the type checker.
// These declarations keep `tsc` quiet for the template's web-only CSS imports.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module '*.css';
