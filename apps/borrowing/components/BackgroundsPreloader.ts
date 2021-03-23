import { FC, useEffect } from 'react';
import { backgroundMap } from '@/data/backgrounds';

export const BackgroundPreloader: FC = () => {
  useEffect(() => {
    const preload = () => {
      // new Image(); preloading trick can still cause flicker sometimes

      if (document.querySelector('.bg-preloading-container')) {
        return;
      }

      const backgrounds = Object.values(backgroundMap).map(v => `url(${v})`);
      const div = document.createElement('div');
      div.className = 'bg-preloading-container';
      div.style.backgroundImage = backgrounds.join(', ');
      document.body.appendChild(div);
    };

    window.addEventListener('load', preload);

    return () => {
      window.removeEventListener('load', preload);
    };
  }, []);

  return null;
};
