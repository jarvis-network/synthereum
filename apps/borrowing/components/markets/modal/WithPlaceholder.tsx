import React from 'react';
import { useLocalStorage } from '@jarvis-network/app-toolkit';
import { Placeholder } from '@/components/markets/modal/Placeholder';

interface Props {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  skipKey: string;
}

export const WithPlaceholder: React.FC<Props> = ({
  children,
  skipKey,
  title,
  subtitle,
}) => {
  const [skipped, setSkipped] = useLocalStorage(
    `jarvis-borrowing/manage-tab-${skipKey}`,
    false,
  );

  if (!skipped) {
    return (
      <Placeholder
        title={title}
        subtitle={subtitle}
        onSkip={() => setSkipped(true)}
      />
    );
  }

  return <>{children}</>;
};
