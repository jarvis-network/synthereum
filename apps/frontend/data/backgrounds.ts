export const backgroundMap = {
  light: '/images/light-mode-background.jpg',
  dark: '/images/dark-mode-background.jpg',
  night: '/images/night-mode-background.jpg',
};

export const backgroundList = Object.values(backgroundMap);

// @TODO this should be in the ui lib as card background color
// (it's a bit different from current colors)
// but after UI change this color won't be needed anyway so let it stay here
// for a short while and then remove
export const mainContentBackground = {
  night: '#2e3541',
  dark: '#292929',
  light: '#fff',
};
