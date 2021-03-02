import React from 'react';

import { useIsMobile } from '@/utils/useIsMobile';

export const OnMobile: React.FC = props => useIsMobile() ? <>{props.children}</> : null;
