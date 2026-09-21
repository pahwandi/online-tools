declare module '~icons/*' {
  const component: (
    props: import('@solidjs/web').JSX.IntrinsicElements['svg'],
  ) => import('@solidjs/web').JSX.Element;
  export default component;
}
