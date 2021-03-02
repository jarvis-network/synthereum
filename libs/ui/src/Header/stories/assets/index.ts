const images: { [key: string]: string } = {};
const paths = require.context('./', true, /\.png$/);
paths.keys().forEach((path: string) => {
  const resolvedPath = paths(path);
  // Storybook
  if (typeof resolvedPath === 'string') images[path] = resolvedPath;
  // Webpack build
  else images[path] = paths(path).default;
});

export { images };
