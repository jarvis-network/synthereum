import { useWindowSize } from "./useWindowSize";

// @TODO use breakpoints value from theme
export const useIsMobile = () => useWindowSize().innerWidth <= 1080;
