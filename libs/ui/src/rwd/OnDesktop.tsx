import React from 'react';
import { useIsMobile } from "../hooks/useIsMobile";

export const OnDesktop: React.FC = props =>
  useIsMobile() ? null : <>{props.children}</>;
