import React from 'react';

import { useIsMobile } from '@/utils/useIsMobile';

export const OnDesktop: React.FC = props => useIsMobile() ? null : <>{props.children}</>;
