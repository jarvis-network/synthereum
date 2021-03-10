import { useWindowSize } from '@jarvis-network/ui';

export const useIsMobile = () => useWindowSize().innerWidth <= 1080;
