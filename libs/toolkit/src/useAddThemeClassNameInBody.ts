import { useEffect } from 'react';

export function useAddThemeClassNameInBody(themeName: string): void {
  useEffect(() => {
    Array.from(document.body.classList).forEach(cls => {
      if (cls.startsWith('theme-')) {
        document.body.classList.remove(cls);
      }
    });
    document.body.classList.add(`theme-${themeName}`);
  }, [themeName]);
}
