import React from 'react';

import { useIsMobile } from '../hooks/useIsMobile';

export const OnDesktop: React.FC = ({ children }) =>
  useIsMobile() ? null : <>{children}</>;
